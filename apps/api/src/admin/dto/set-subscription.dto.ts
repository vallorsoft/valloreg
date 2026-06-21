import { IsEnum } from 'class-validator';
import { PlanTier } from '@valloreg/shared';
import { SubscriptionStatus } from '@prisma/client';

export class SetSubscriptionDto {
  @IsEnum(PlanTier, { message: 'Érvénytelen csomag.' })
  planTier!: PlanTier;

  @IsEnum(SubscriptionStatus, { message: 'Érvénytelen előfizetés-állapot.' })
  status!: SubscriptionStatus;
}
