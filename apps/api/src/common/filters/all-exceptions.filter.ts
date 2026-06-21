import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCode } from '@valloreg/shared';
import type { ApiErrorBody } from '@valloreg/shared';
import type { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';

/**
 * Globális kivételszűrő. Minden hibát az egységes @valloreg/shared ApiErrorBody
 * alakra képez le ({ code, message, details? }), hogy a frontend i18n-elhesse.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.toErrorResponse(exception);

    if (status >= 500) {
      // A kérés metódusa + útvonala + a TÉNYLEGES hiba a logba kerül, hogy a
      // generikus INTERNAL_ERROR mögötti valódi ok (pl. hiányzó tábla, DB hiba)
      // azonosítható legyen a Render logokból.
      const where = `${request?.method ?? '?'} ${request?.originalUrl ?? request?.url ?? '?'}`;
      const detail =
        exception instanceof Error
          ? `${exception.name}: ${exception.message}`
          : String(exception);
      this.logger.error(
        `[${where}] ${body.code}: ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }

  private toErrorResponse(exception: unknown): {
    status: number;
    body: ApiErrorBody;
  } {
    // 1) A saját AppException már hordozza a kódot.
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: {
          code: exception.code,
          message: exception.message,
          ...(exception.details ? { details: exception.details } : {}),
        },
      };
    }

    // 2) NestJS HttpException (pl. ValidationPipe, beépített guard-ok).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return {
        status,
        body: this.fromHttpException(status, res),
      };
    }

    // 3) Ismeretlen hiba → 500 + generikus kód.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Váratlan szerverhiba történt.',
      },
    };
  }

  private fromHttpException(
    status: number,
    res: string | object,
  ): ApiErrorBody {
    const code = this.mapStatusToCode(status);

    // ValidationPipe alakja: { message: string[] | string, error, statusCode }
    if (typeof res === 'object' && res !== null) {
      const obj = res as Record<string, unknown>;
      const rawMessage = obj.message;

      if (Array.isArray(rawMessage)) {
        return {
          code: ErrorCode.VALIDATION_FAILED,
          message: 'A bemenet validációja sikertelen.',
          details: { _errors: rawMessage.map(String) },
        };
      }

      const message =
        typeof rawMessage === 'string'
          ? rawMessage
          : this.defaultMessage(status);
      return { code, message };
    }

    return { code, message: typeof res === 'string' ? res : this.defaultMessage(status) };
  }

  private mapStatusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.AUTH_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      default:
        return status >= 500
          ? ErrorCode.INTERNAL_ERROR
          : ErrorCode.VALIDATION_FAILED;
    }
  }

  private defaultMessage(status: number): string {
    if (status >= 500) return 'Váratlan szerverhiba történt.';
    return 'A kérés feldolgozása sikertelen.';
  }
}
