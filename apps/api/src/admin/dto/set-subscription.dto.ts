import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PlanTier } from '@valloreg/shared';
import { SubscriptionStatus } from '@prisma/client';

export class SetSubscriptionDto {
  @IsEnum(PlanTier, { message: 'Érvénytelen csomag.' })
  planTier!: PlanTier;

  @IsEnum(SubscriptionStatus, { message: 'Érvénytelen előfizetés-állapot.' })
  status!: SubscriptionStatus;

  /** Megvásárolt extra tárhely GB-ban (opcionális; ha megadva, felülírja). */
  @IsOptional()
  @IsInt({ message: 'Érvénytelen extra tárhely érték.' })
  @Min(0, { message: 'Az extra tárhely nem lehet negatív.' })
  extraStorageGB?: number;
}
