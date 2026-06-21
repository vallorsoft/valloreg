import { IsEnum } from 'class-validator';
import { PlanTier } from '@valloreg/shared';

export class RequestSubscriptionDto {
  @IsEnum(PlanTier, { message: 'Érvénytelen csomag.' })
  planTier!: PlanTier;
}
