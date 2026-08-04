import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { REQUIRE_POW_KEY } from "../decorators/require-pow.decorator";
import { ProofOfWorkService } from "./proof-of-work.service";

@Injectable()
export class ProofOfWorkGuard implements CanActivate {
  constructor(
    private readonly pow: ProofOfWorkService,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_POW_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header("x-pow-solution");
    const separatorIndex = header?.indexOf(":") ?? -1;
    if (!header || separatorIndex < 0) {
      throw new HttpException(
        { code: "proof_of_work_required", message: "A proof-of-work solution is required for this endpoint." },
        HttpStatus.FORBIDDEN
      );
    }

    const nonce = header.slice(0, separatorIndex);
    const solution = header.slice(separatorIndex + 1);
    const result = this.pow.verify(nonce, solution);
    if (!result.ok) {
      throw new HttpException(
        { code: `proof_of_work_${result.reason}`, message: "Invalid or expired proof-of-work solution." },
        HttpStatus.FORBIDDEN
      );
    }
    return true;
  }
}
