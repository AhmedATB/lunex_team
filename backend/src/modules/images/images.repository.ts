import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ImagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAssetById(id: string) {
    return this.prisma.imageAsset.findUnique({ where: { id } });
  }

  createAsset(params: { storageKey: string; checksum: string }) {
    return this.prisma.imageAsset.create({ data: params });
  }

  logAccess(params: {
    assetId: string;
    userId: string;
    deviceFingerprint: string;
    ip: string;
    event: "token_issued" | "stream_served" | "token_rejected";
    reason?: string;
  }) {
    return this.prisma.imageAccessLog.create({ data: params });
  }
}
