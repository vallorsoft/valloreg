import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Jelöli, hogy a végpont hitelesítés nélkül elérhető (a JwtAuthGuard átengedi).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
