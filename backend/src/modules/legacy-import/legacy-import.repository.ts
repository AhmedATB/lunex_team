import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

interface UpsertTeamData {
  externalId: string;
  name: string;
  description: string | null;
  isOfficial: boolean;
  isVerified: boolean;
  isInactive: boolean;
}

interface UpsertSeriesData {
  externalId: string;
  title: string;
  altTitles: Prisma.InputJsonValue | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  status: string;
  originalLanguage: string | null;
  contentRating: string | null;
  publicationDemographic: string | null;
  year: number | null;
  tags: Prisma.InputJsonValue | null;
  coverImage?: Buffer | null;
  coverMimeType?: string | null;
}

@Injectable()
export class LegacyImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertTeam(data: UpsertTeamData) {
    return this.prisma.team.upsert({
      where: { externalId: data.externalId },
      create: data,
      update: data,
    });
  }

  findTeamByExternalId(externalId: string) {
    return this.prisma.team.findUnique({ where: { externalId } });
  }

  upsertSeries(data: UpsertSeriesData) {
    const { externalId, altTitles, tags, ...rest } = data;
    // Prisma's nullable-Json columns need the Prisma.JsonNull sentinel for an explicit null, not the plain JS value.
    const jsonFields = { altTitles: altTitles ?? Prisma.JsonNull, tags: tags ?? Prisma.JsonNull };
    return this.prisma.series.upsert({
      where: { externalId },
      create: { externalId, ...rest, ...jsonFields },
      update: { ...rest, ...jsonFields },
    });
  }

  findSeriesByExternalId(externalId: string) {
    return this.prisma.series.findUnique({ where: { externalId } });
  }

  findChapterByExternalId(externalId: string) {
    return this.prisma.chapter.findUnique({ where: { externalId } });
  }

  markChapterExternalId(chapterId: string, externalId: string) {
    return this.prisma.chapter.update({ where: { id: chapterId }, data: { externalId } });
  }

  countTeams() {
    return this.prisma.team.count();
  }

  countSeries() {
    return this.prisma.series.count();
  }

  countImportedChapters() {
    return this.prisma.chapter.count({ where: { externalId: { not: null } } });
  }
}
