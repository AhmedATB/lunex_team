import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CatalogService } from "./catalog.service";

/**
 * The public, read-only catalogue. Everything here is @Public() and
 * @SkipThrottle(): these are the reads every page render makes, and the
 * per-IP limiter (which sees the frontend's server as one IP) would otherwise
 * throttle the whole site instead of any one abuser. CatalogService keeps a
 * short in-memory cache in front of the database to bound the cost instead.
 */
@Public()
@SkipThrottle()
@Controller("v1/catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("bootstrap")
  @HttpCode(HttpStatus.OK)
  bootstrap() {
    return this.catalog.bootstrapCached();
  }

  @Get("series/:slug")
  @HttpCode(HttpStatus.OK)
  series(@Param("slug") slug: string) {
    return this.catalog.seriesDetail(slug);
  }

  @Get("teams/:slug")
  @HttpCode(HttpStatus.OK)
  team(@Param("slug") slug: string) {
    return this.catalog.teamDetail(slug);
  }

  @Get("series/:id/cover")
  cover(@Param("id") id: string, @Res() res: Response) {
    return this.sendImage("series", id, res);
  }

  @Get("series/:id/banner")
  banner(@Param("id") id: string, @Res() res: Response) {
    return this.sendImage("banner", id, res);
  }

  @Get("teams/:id/logo")
  logo(@Param("id") id: string, @Res() res: Response) {
    return this.sendImage("team", id, res);
  }

  @Get("news/:id/cover")
  newsCover(@Param("id") id: string, @Res() res: Response) {
    return this.sendImage("news", id, res);
  }

  /** The URL carries a version stamp (see imageUrl), so an image can be cached for a year — a replaced one gets a new URL. */
  private async sendImage(target: "series" | "banner" | "team" | "news", id: string, res: Response) {
    const image = await this.catalog.image(target, id);
    if (!image) throw new NotFoundException({ code: "image_not_found", message: "No image for this item." });
    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(image.data);
  }
}
