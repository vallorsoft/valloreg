import { IsEnum, IsOptional } from 'class-validator';
import { BillingInterval, PlanTier } from '@valloreg/shared';

export class RequestSubscriptionDto {
  @IsEnum(PlanTier, { message: 'Érvénytelen csomag.' })
  planTier!: PlanTier;

  /** Számlázási ciklus (alapértelmezett: havi). Éves esetén 11 havidíj. */
  @IsOptional()
  @IsEnum(BillingInterval, { message: 'Érvénytelen számlázási ciklus.' })
  interval?: BillingInterval;
}
