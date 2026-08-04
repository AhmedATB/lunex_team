import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Centralized error handling (architecture doc §3): the client always gets a
 * stable {statusCode, code, message} shape and nothing else — no stack
 * traces, no internal error class names, no DB error text. Everything else
 * goes to the server log only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const safeMessage = isHttp
      ? this.extractMessage(exception)
      : "Something went wrong. Please try again.";

    const code = isHttp ? this.deriveCode(exception) : "internal_error";

    if (!isHttp || statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    response.status(statusCode).json({
      statusCode,
      code,
      message: safeMessage,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === "string") return res;
    if (typeof res === "object" && res !== null && "message" in res) {
      const m = (res as { message: unknown }).message;
      return Array.isArray(m) ? m.join(", ") : String(m);
    }
    return exception.message;
  }

  private deriveCode(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === "object" && res !== null && "code" in res) {
      return String((res as { code: unknown }).code);
    }
    return exception.constructor.name.replace(/Exception$/, "").toLowerCase();
  }
}
