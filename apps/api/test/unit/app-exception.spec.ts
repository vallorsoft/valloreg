import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@valloreg/shared';
import { AppException } from '../../src/common/exceptions/app.exception';

/**
 * Prisma-mentes egységteszt az AppException statikus factory-khoz.
 * Minden factory a helyes ErrorCode-ot és HTTP státuszt kell hordozza.
 */
describe('AppException factories', () => {
  type Case = {
    name: string;
    make: () => AppException;
    code: ErrorCode;
    status: HttpStatus;
  };

  const cases: Case[] = [
    // ── Auth ──
    {
      name: 'invalidCredentials',
      make: () => AppException.invalidCredentials(),
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      status: HttpStatus.UNAUTHORIZED,
    },
    {
      name: 'emailTaken',
      make: () => AppException.emailTaken(),
      code: ErrorCode.AUTH_EMAIL_TAKEN,
      status: HttpStatus.CONFLICT,
    },
    {
      name: 'tokenExpired',
      make: () => AppException.tokenExpired(),
      code: ErrorCode.AUTH_TOKEN_EXPIRED,
      status: HttpStatus.UNAUTHORIZED,
    },
    {
      name: 'tokenInvalid',
      make: () => AppException.tokenInvalid(),
      code: ErrorCode.AUTH_TOKEN_INVALID,
      status: HttpStatus.UNAUTHORIZED,
    },
    {
      name: 'unauthorized',
      make: () => AppException.unauthorized(),
      code: ErrorCode.AUTH_UNAUTHORIZED,
      status: HttpStatus.UNAUTHORIZED,
    },
    {
      name: 'forbidden',
      make: () => AppException.forbidden(),
      code: ErrorCode.AUTH_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    },
    // ── Tenant ──
    {
      name: 'tenantNotFound',
      make: () => AppException.tenantNotFound(),
      code: ErrorCode.TENANT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    },
    {
      name: 'tenantAccessDenied',
      make: () => AppException.tenantAccessDenied(),
      code: ErrorCode.TENANT_ACCESS_DENIED,
      status: HttpStatus.FORBIDDEN,
    },
    // ── Limitek ──
    {
      name: 'vehiclesLimitReached',
      make: () => AppException.vehiclesLimitReached(),
      code: ErrorCode.LIMIT_VEHICLES_REACHED,
      status: HttpStatus.FORBIDDEN,
    },
    {
      name: 'usersLimitReached',
      make: () => AppException.usersLimitReached(),
      code: ErrorCode.LIMIT_USERS_REACHED,
      status: HttpStatus.FORBIDDEN,
    },
    {
      name: 'documentsLimitReached',
      make: () => AppException.documentsLimitReached(),
      code: ErrorCode.LIMIT_DOCUMENTS_REACHED,
      status: HttpStatus.FORBIDDEN,
    },
    // ── Feature flag ──
    {
      name: 'featureDisabled',
      make: () => AppException.featureDisabled(),
      code: ErrorCode.FEATURE_DISABLED,
      status: HttpStatus.FORBIDDEN,
    },
    // ── Dokumentum ──
    {
      name: 'unsupportedDocumentType',
      make: () => AppException.unsupportedDocumentType(),
      code: ErrorCode.DOCUMENT_UNSUPPORTED_TYPE,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    },
    {
      name: 'documentTooLarge',
      make: () => AppException.documentTooLarge(),
      code: ErrorCode.DOCUMENT_TOO_LARGE,
      status: HttpStatus.PAYLOAD_TOO_LARGE,
    },
    {
      name: 'processingFailed',
      make: () => AppException.processingFailed(),
      code: ErrorCode.PROCESSING_FAILED,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    },
    // ── Általános ──
    {
      name: 'notFound',
      make: () => AppException.notFound(),
      code: ErrorCode.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    },
    {
      name: 'validation',
      make: () => AppException.validation(),
      code: ErrorCode.VALIDATION_FAILED,
      status: HttpStatus.BAD_REQUEST,
    },
  ];

  it.each(cases)('$name a helyes kódot és státuszt hordozza', ({ make, code, status }) => {
    const ex = make();
    expect(ex).toBeInstanceOf(AppException);
    expect(ex.code).toBe(code);
    expect(ex.getStatus()).toBe(status);
  });

  it('a custom üzenetet és a details-t megtartja a validation()', () => {
    const details = { email: ['kötelező'] };
    const ex = AppException.validation('Hibás bemenet', details);
    expect(ex.message).toBe('Hibás bemenet');
    expect(ex.details).toEqual(details);
    expect(ex.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('a forbidden() átveszi a custom üzenetet', () => {
    const ex = AppException.forbidden('Saját üzenet');
    expect(ex.message).toBe('Saját üzenet');
    expect(ex.code).toBe(ErrorCode.AUTH_FORBIDDEN);
  });
});
