import { BadRequestException, NotFoundException } from "@nestjs/common";
import { canView } from "./profile-visibility.util";
import type { ProfilesRepository } from "./profiles.repository";
import { ProfilesService } from "./profiles.service";

describe("canView", () => {
  const anonymous = { isSelf: false, isStaff: false, signedIn: false };
  const member = { isSelf: false, isStaff: false, signedIn: true };

  it("lets anyone open a public section", () => {
    expect(canView("public", anonymous)).toBe(true);
  });

  it("lets only signed-in accounts open a members section", () => {
    expect(canView("members", anonymous)).toBe(false);
    expect(canView("members", member)).toBe(true);
  });

  it("keeps a private section from everyone but the owner and staff", () => {
    expect(canView("private", anonymous)).toBe(false);
    expect(canView("private", member)).toBe(false);
    expect(canView("private", { ...member, isSelf: true })).toBe(true);
    expect(canView("private", { ...member, isStaff: true })).toBe(true);
  });

  it("treats an unrecognised level as private", () => {
    expect(canView("everyone", member)).toBe(false);
    expect(canView("", anonymous)).toBe(false);
  });
});

interface ProfileRow {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  avatarMimeType: string | null;
  profileVisibility: string;
  historyVisibility: string;
  favoritesVisibility: string;
}

const ALICE: ProfileRow = {
  id: "alice-id",
  username: "alice",
  displayName: null,
  bio: null,
  role: "reader",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  avatarMimeType: null,
  profileVisibility: "public",
  historyVisibility: "private",
  favoritesVisibility: "private",
};

function build(userOverrides: Partial<ProfileRow> = {}, viewerRow: { id: string; role: string } | null = null) {
  const repo = {
    findProfileByUsername: jest.fn().mockResolvedValue({ ...ALICE, ...userOverrides }),
    findViewer: jest.fn().mockResolvedValue(viewerRow),
    listBookmarks: jest.fn().mockResolvedValue([{ seriesId: "series-1" }, { seriesId: "series-2" }]),
    listProgress: jest
      .fn()
      .mockResolvedValue([{ seriesId: "series-1", chapterNumber: 12, lastReadAt: new Date("2026-03-01T00:00:00Z") }]),
    countBookmarks: jest.fn().mockResolvedValue(0),
    addBookmark: jest.fn().mockResolvedValue(undefined),
    removeBookmark: jest.fn().mockResolvedValue(undefined),
    upsertProgress: jest.fn().mockResolvedValue(1),
    mergeLibrary: jest.fn().mockResolvedValue(undefined),
    updatePrivacy: jest.fn(),
  };
  return { service: new ProfilesService(repo as unknown as ProfilesRepository), repo };
}

describe("ProfilesService.getProfile", () => {
  it("404s for an unknown username", async () => {
    const { service, repo } = build();
    repo.findProfileByUsername.mockResolvedValue(null);
    await expect(service.getProfile("nobody", undefined)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("hides private lists from a stranger and leaves the fields out entirely", async () => {
    const { service, repo } = build();
    const profile = await service.getProfile("alice", undefined);
    expect(profile).toMatchObject({ restricted: false, access: { profile: true, history: false, favorites: false } });
    expect(profile).not.toHaveProperty("bookmarks");
    expect(profile).not.toHaveProperty("history");
    expect(profile).not.toHaveProperty("visibility");
    expect(repo.listBookmarks).not.toHaveBeenCalled();
    expect(repo.listProgress).not.toHaveBeenCalled();
  });

  it("shows a public favorites list and a members-only history to a signed-in viewer", async () => {
    const { service } = build(
      { favoritesVisibility: "public", historyVisibility: "members" },
      { id: "bob-id", role: "reader" }
    );
    const profile = await service.getProfile("alice", { id: "bob-id" });
    expect(profile).toMatchObject({ bookmarks: ["series-1", "series-2"], history: [{ seriesId: "series-1", chapterNumber: 12 }] });
  });

  it("does not show a members-only history to an anonymous viewer", async () => {
    const { service } = build({ historyVisibility: "members", favoritesVisibility: "public" });
    const profile = await service.getProfile("alice", undefined);
    expect(profile).not.toHaveProperty("history");
    expect(profile).toHaveProperty("bookmarks");
  });

  it("treats a valid token for a deleted account as anonymous", async () => {
    const { service } = build({ historyVisibility: "members" }, null);
    const profile = await service.getProfile("alice", { id: "ghost-id" });
    expect(profile).not.toHaveProperty("history");
  });

  it("returns only the identity for a private profile, whatever the section levels say", async () => {
    const { service } = build({ profileVisibility: "private", historyVisibility: "public", favoritesVisibility: "public" });
    const profile = await service.getProfile("alice", undefined);
    expect(profile).toMatchObject({ restricted: true, username: "alice", access: { profile: false, history: false, favorites: false } });
    expect(profile).not.toHaveProperty("bio");
    expect(profile).not.toHaveProperty("bookmarks");
    expect(profile).not.toHaveProperty("history");
  });

  it("shows the owner everything of theirs, plus their chosen levels", async () => {
    const { service } = build({ profileVisibility: "private" }, { id: "alice-id", role: "reader" });
    const profile = await service.getProfile("alice", { id: "alice-id" });
    expect(profile).toMatchObject({
      isSelf: true,
      restricted: false,
      access: { profile: true, history: true, favorites: true },
      visibility: { profile: "private", history: "private", favorites: "private" },
    });
    expect(profile).toHaveProperty("bookmarks");
    expect(profile).toHaveProperty("history");
  });

  it("lets a moderator see hidden sections, but not an ordinary member with a staff-looking id", async () => {
    const mod = build({}, { id: "mod-id", role: "moderator" });
    expect(await mod.service.getProfile("alice", { id: "mod-id" })).toHaveProperty("history");
    const editor = build({}, { id: "ed-id", role: "editor" });
    expect(await editor.service.getProfile("alice", { id: "ed-id" })).not.toHaveProperty("history");
  });

  it("reads the viewer's role fresh from the database, not from the token", async () => {
    const { service, repo } = build({}, { id: "x", role: "reader" });
    await service.getProfile("alice", { id: "x" });
    expect(repo.findViewer).toHaveBeenCalledWith("x");
  });

  it("exposes an avatar version only when an avatar exists", async () => {
    const without = await build().service.getProfile("alice", undefined);
    expect(without.avatarVersion).toBeNull();
    const withAvatar = await build({ avatarMimeType: "image/webp" }).service.getProfile("alice", undefined);
    expect(withAvatar.avatarVersion).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("ProfilesService library", () => {
  it("rejects malformed series ids", async () => {
    const { service, repo } = build();
    for (const bad of ["", "a b", "../x", "x".repeat(65), "sér"]) {
      await expect(service.addBookmark("u", bad)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setProgress("u", bad, 1)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repo.addBookmark).not.toHaveBeenCalled();
    expect(repo.upsertProgress).not.toHaveBeenCalled();
  });

  it("drops bad entries from a sync but keeps the good ones", async () => {
    const { service, repo } = build();
    await service.syncLibrary("u", {
      bookmarks: ["series-1", "series-1", "bad id", "series-2"],
      progress: { "series-1": 5, "bad id": 3, "series-3": -1, "series-4": Number.POSITIVE_INFINITY, "series-5": 2.5 },
    });
    expect(repo.mergeLibrary).toHaveBeenCalledWith(
      "u",
      ["series-1", "series-2"],
      [
        ["series-1", 5],
        ["series-5", 2.5],
      ]
    );
  });

  it("refuses an empty privacy update", async () => {
    const { service } = build();
    await expect(service.updatePrivacy("u", {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
