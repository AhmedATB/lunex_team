import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Railway's deploy healthcheck (railway.json). A new deployment only replaces the
 * running one once this answers 200, so a build that boots but cannot reach the
 * database (or crashes on start) never takes the live site down.
 */
@Public()
@SkipThrottle()
@Controller("v1/health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ code: "database_unavailable", message: "Database is not reachable." });
    }
    return { status: "ok" };
  }
}
