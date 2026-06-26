import { describe, it, expect } from 'vitest';
import { ErrorCode } from '@valloreg/shared';
import { ApiError, resolveErrorKey, errorDebugSuffix } from './api';

describe('resolveErrorKey', () => {
  it('ismert ErrorCode-ot hordozó ApiError-ra ugyanazt a kódot adja', () => {
    const err = new ApiError(ErrorCode.AUTH_INVALID_CREDENTIALS, 401, 'nope');
    expect(resolveErrorKey(err)).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
  });

  it('NETWORK_ERROR kódot is ismertként visszaad', () => {
    const err = new ApiError('NETWORK_ERROR', 0, 'failed to fetch');
    expect(resolveErrorKey(err)).toBe('NETWORK_ERROR');
  });

  it('ismeretlen kódú ApiError-ra INTERNAL_ERROR-ra esik', () => {
    const err = new ApiError(
      'VALAMI_ISMERETLEN' as ErrorCode,
      500,
      'unknown',
    );
    expect(resolveErrorKey(err)).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it('nem-ApiError (sima Error) esetén INTERNAL_ERROR', () => {
    expect(resolveErrorKey(new Error('boom'))).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it('nem-Error érték (pl. string) esetén INTERNAL_ERROR', () => {
    expect(resolveErrorKey('csak egy string')).toBe(ErrorCode.INTERNAL_ERROR);
    expect(resolveErrorKey(null)).toBe(ErrorCode.INTERNAL_ERROR);
  });
});

describe('errorDebugSuffix', () => {
  it('INTERNAL_ERROR esetén a HTTP státuszt fűzi', () => {
    const err = new ApiError(ErrorCode.INTERNAL_ERROR, 500, 'server error');
    expect(errorDebugSuffix(err)).toBe(' (HTTP 500)');
  });

  it('NETWORK_ERROR + státusz esetén a HTTP státuszt fűzi', () => {
    const err = new ApiError('NETWORK_ERROR', 404, 'not found');
    expect(errorDebugSuffix(err)).toBe(' (HTTP 404)');
  });

  it('NETWORK_ERROR státusz nélkül (0) a "nincs válasz" utótagot adja', () => {
    const err = new ApiError('NETWORK_ERROR', 0, 'failed to fetch');
    expect(errorDebugSuffix(err)).toBe(' (nincs válasz)');
  });

  it('üzleti hibánál üres stringet ad', () => {
    const err = new ApiError(ErrorCode.AUTH_INVALID_CREDENTIALS, 401, 'nope');
    expect(errorDebugSuffix(err)).toBe('');
  });

  it('nem-ApiError esetén üres stringet ad', () => {
    expect(errorDebugSuffix(new Error('boom'))).toBe('');
    expect(errorDebugSuffix('string')).toBe('');
  });
});

describe('ApiError', () => {
  it('a kódot, státuszt és details-t hordozza', () => {
    const details = { email: ['kötelező'] };
    const err = new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'invalid', details);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(err.status).toBe(422);
    expect(err.message).toBe('invalid');
    expect(err.details).toEqual(details);
  });
});
