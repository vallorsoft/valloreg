import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@valloreg/shared';

/**
 * Egységes alkalmazás-kivétel, ami a @valloreg/shared ErrorCode-ot hordozza.
 * A globális exception filter ezt képezi le ApiErrorBody-vá.
 *
 * A statikus factory-k a tipikus hibákat fedik le, helyes HTTP státusszal.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message, status);
  }

  // ── Auth ──────────────────────────────────────────────────────────────
  static invalidCredentials(): AppException {
    return new AppException(
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      'Hibás email vagy jelszó.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  static emailTaken(): AppException {
    return new AppException(
      ErrorCode.AUTH_EMAIL_TAKEN,
      'Ez az email cím már foglalt.',
      HttpStatus.CONFLICT,
    );
  }

  static tokenExpired(): AppException {
    return new AppException(
      ErrorCode.AUTH_TOKEN_EXPIRED,
      'A token lejárt.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  static tokenInvalid(): AppException {
    return new AppException(
      ErrorCode.AUTH_TOKEN_INVALID,
      'Érvénytelen token.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  static unauthorized(message = 'Hitelesítés szükséges.'): AppException {
    return new AppException(
      ErrorCode.AUTH_UNAUTHORIZED,
      message,
      HttpStatus.UNAUTHORIZED,
    );
  }

  static forbidden(message = 'Nincs jogosultság a művelethez.'): AppException {
    return new AppException(
      ErrorCode.AUTH_FORBIDDEN,
      message,
      HttpStatus.FORBIDDEN,
    );
  }

  // ── Tenant ────────────────────────────────────────────────────────────
  static tenantNotFound(): AppException {
    return new AppException(
      ErrorCode.TENANT_NOT_FOUND,
      'A cég nem található.',
      HttpStatus.NOT_FOUND,
    );
  }

  static tenantAccessDenied(): AppException {
    return new AppException(
      ErrorCode.TENANT_ACCESS_DENIED,
      'Nincs hozzáférésed ehhez a céghez.',
      HttpStatus.FORBIDDEN,
    );
  }

  // ── Limitek ───────────────────────────────────────────────────────────
  static vehiclesLimitReached(): AppException {
    return new AppException(
      ErrorCode.LIMIT_VEHICLES_REACHED,
      'Elérted a járművek számának csomag-limitjét.',
      HttpStatus.FORBIDDEN,
    );
  }

  static usersLimitReached(): AppException {
    return new AppException(
      ErrorCode.LIMIT_USERS_REACHED,
      'Elérted a felhasználók számának csomag-limitjét.',
      HttpStatus.FORBIDDEN,
    );
  }

  static documentsLimitReached(): AppException {
    return new AppException(
      ErrorCode.LIMIT_DOCUMENTS_REACHED,
      'Elérted a havi dokumentum-feldolgozás csomag-limitjét.',
      HttpStatus.FORBIDDEN,
    );
  }

  static storageLimitReached(): AppException {
    return new AppException(
      ErrorCode.LIMIT_STORAGE_REACHED,
      'Betelt a tárhelyed. Bővítsd a tárhelyet vagy válts nagyobb csomagra.',
      HttpStatus.FORBIDDEN,
    );
  }

  // ── Feature flag ──────────────────────────────────────────────────────
  static featureDisabled(message = 'A funkció nincs engedélyezve a csomagodban.'): AppException {
    return new AppException(
      ErrorCode.FEATURE_DISABLED,
      message,
      HttpStatus.FORBIDDEN,
    );
  }

  // ── Dokumentum ────────────────────────────────────────────────────────
  static unsupportedDocumentType(): AppException {
    return new AppException(
      ErrorCode.DOCUMENT_UNSUPPORTED_TYPE,
      'Nem támogatott fájltípus. Engedélyezett: PDF, JPG, PNG.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  static documentTooLarge(): AppException {
    return new AppException(
      ErrorCode.DOCUMENT_TOO_LARGE,
      'A fájl túl nagy (max 25 MB).',
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }

  static processingFailed(message = 'A dokumentum feldolgozása sikertelen.'): AppException {
    return new AppException(
      ErrorCode.PROCESSING_FAILED,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  // ── Excel köteges import ──────────────────────────────────────────────
  static unsupportedSpreadsheetType(): AppException {
    return new AppException(
      ErrorCode.SPREADSHEET_UNSUPPORTED_TYPE,
      'Nem támogatott táblázat-típus. Engedélyezett: XLSX, XLS.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  static spreadsheetParseFailed(
    message = 'A táblázat beolvasása sikertelen.',
  ): AppException {
    return new AppException(
      ErrorCode.SPREADSHEET_PARSE_FAILED,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  static spreadsheetNoData(
    message = 'A táblázatban nincs feldolgozható számla-adat.',
  ): AppException {
    return new AppException(
      ErrorCode.SPREADSHEET_NO_DATA,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  // ── Általános ─────────────────────────────────────────────────────────
  static notFound(message = 'Az erőforrás nem található.'): AppException {
    return new AppException(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }

  static validation(
    message = 'A bemenet validációja sikertelen.',
    details?: Record<string, string[]>,
  ): AppException {
    return new AppException(
      ErrorCode.VALIDATION_FAILED,
      message,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}
