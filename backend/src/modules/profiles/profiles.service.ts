import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MODERATOR_ROLES } from "../../common/roles";
import { MAX_CHAPTER_NUMBER, MAX_SYNC_ITEMS, type SyncLibraryDto } from "./dto/progress.dto";
import type { UpdatePrivacyDto } from "./dto/update-privacy.dto";
import { publicProgress } from "../progress/progress.service";
import { dayKey } from "../progress/progress.util";
import { canView, type Viewer } from "./profile-visibility.util";
import { ProfilesRepository } from "./profiles.repository";

const SERIES_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BOOKMARKS_PER_USER = 2000;
const PROFILE_BOOKMARK_LIMIT = 500;
const PROFILE_HISTORY_LIMIT = 100;

export interface ProfileViewer {
  id: string;
}

@Injectable()
export class ProfilesService {
  constructor(private readonly repo: ProfilesRepository) {}

  /**
   * What `viewer` (undefined = signed out) may see of `username`. The name and
   * picture are always returned — they already appear wherever the account
   * comments — but everything else follows the owner's own visibility choices,
   * and a section that is hidden is left out of the response entirely rather
   * than sent empty (so nothing leaks through payload size or a null field).
   */
  async getProfile(username: string, viewer: ProfileViewer | undefined) {
    const user = await this.repo.findProfileByUsername(username);
    if (!user) {
      throw new NotFoundException({ code: "profile_not_found", message: "This profile does not exist." });
    }

    const viewerRow = viewer ? await this.repo.findViewer(viewer.id) : null;
    const ctx: Viewer = {
      isSelf: viewerRow?.id === user.id,
      isStaff: viewerRow ? MODERATOR_ROLES.has(viewerRow.role) : false,
      signedIn: viewerRow !== null,
    };

    const identity = {
      id: user.id,
      username: user.username,
      displayName: user.displayName ?? user.username,
      role: user.role,
      avatarVersion: user.avatarMimeType ? user.updatedAt.toISOString() : null,
      isSelf: ctx.isSelf,
    };

    const access = {
      profile: canView(user.profileVisibility, ctx),
      history: canView(user.historyVisibility, ctx),
      favorites: canView(user.favoritesVisibility, ctx),
    };

    // A hidden profile hides its sections too, whatever their own levels say.
    if (!access.profile) {
      return { ...identity, restricted: true, access: { profile: false, history: false, favorites: false } };
    }

    const [bookmarks, history] = await Promise.all([
      access.favorites ? this.repo.listBookmarks(user.id, PROFILE_BOOKMARK_LIMIT) : null,
      access.history ? this.repo.listProgress(user.id, PROFILE_HISTORY_LIMIT) : null,
    ]);

    return {
      ...identity,
      restricted: false,
      bio: user.bio ?? "",
      createdAt: user.createdAt,
      access,
      // Only the owner and staff are told what level each section is set to.
      ...(ctx.isSelf || ctx.isStaff
        ? {
            visibility: {
              profile: user.profileVisibility,
              history: user.historyVisibility,
              favorites: user.favoritesVisibility,
            },
          }
        : {}),
      // Level, experience, streak and achievements say how much someone reads, so they follow the history setting.
      ...(access.history
        ? {
            progress: publicProgress(
              {
                xp: user.xp,
                xpDay: user.xpDay ? dayKey(user.xpDay) : null,
                xpDayGain: user.xpDayGain,
                chaptersRead: user.chaptersRead,
                streakDays: user.streakDays,
                bestStreak: user.bestStreak,
                streakLastDay: user.streakLastDay ? dayKey(user.streakLastDay) : null,
                achievements: user.achievements,
              },
              dayKey(new Date())
            ),
          }
        : {}),
      ...(bookmarks ? { bookmarks: bookmarks.map((b) => b.seriesId) } : {}),
      ...(history
        ? {
            history: history.map((h) => ({
              seriesId: h.seriesId,
              chapterNumber: h.chapterNumber,
              lastReadAt: h.lastReadAt,
            })),
          }
        : {}),
    };
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacyDto) {
    const patch = {
      profileVisibility: dto.profileVisibility,
      historyVisibility: dto.historyVisibility,
      favoritesVisibility: dto.favoritesVisibility,
    };
    if (Object.values(patch).every((v) => v === undefined)) {
      throw new BadRequestException({ code: "empty_update", message: "Nothing to change." });
    }
    const updated = await this.repo.updatePrivacy(userId, patch);
    return {
      profileVisibility: updated.profileVisibility,
      historyVisibility: updated.historyVisibility,
      favoritesVisibility: updated.favoritesVisibility,
    };
  }

  /** The account's saved library — what the client merges into its local stores on sign-in. */
  async getLibrary(userId: string) {
    const [bookmarks, progress] = await Promise.all([
      this.repo.listBookmarks(userId, MAX_BOOKMARKS_PER_USER),
      this.repo.listProgress(userId, MAX_BOOKMARKS_PER_USER),
    ]);
    return {
      bookmarks: bookmarks.map((b) => b.seriesId),
      progress: Object.fromEntries(progress.map((p) => [p.seriesId, p.chapterNumber])),
    };
  }

  async addBookmark(userId: string, seriesId: string): Promise<void> {
    this.assertSeriesId(seriesId);
    if ((await this.repo.countBookmarks(userId)) >= MAX_BOOKMARKS_PER_USER) {
      throw new ConflictException({ code: "bookmark_limit", message: "You have reached the favorites limit." });
    }
    await this.repo.addBookmark(userId, seriesId);
  }

  async removeBookmark(userId: string, seriesId: string): Promise<void> {
    this.assertSeriesId(seriesId);
    await this.repo.removeBookmark(userId, seriesId);
  }

  async setProgress(userId: string, seriesId: string, chapterNumber: number): Promise<void> {
    this.assertSeriesId(seriesId);
    await this.repo.upsertProgress(userId, seriesId, chapterNumber);
  }

  /** Malformed entries are dropped rather than failing the whole sync — one bad id from a stale client must not block the rest. */
  async syncLibrary(userId: string, dto: SyncLibraryDto) {
    const bookmarks = [...new Set(dto.bookmarks ?? [])].filter((id) => SERIES_ID_PATTERN.test(id));
    const progress = Object.entries(dto.progress ?? {})
      .slice(0, MAX_SYNC_ITEMS)
      .filter(
        (entry): entry is [string, number] =>
          SERIES_ID_PATTERN.test(entry[0]) &&
          typeof entry[1] === "number" &&
          Number.isFinite(entry[1]) &&
          entry[1] >= 0 &&
          entry[1] <= MAX_CHAPTER_NUMBER
      );
    await this.repo.mergeLibrary(userId, bookmarks, progress);
    return this.getLibrary(userId);
  }

  private assertSeriesId(seriesId: string) {
    if (!SERIES_ID_PATTERN.test(seriesId)) {
      throw new BadRequestException({ code: "invalid_series_id", message: "Invalid series id." });
    }
  }
}
