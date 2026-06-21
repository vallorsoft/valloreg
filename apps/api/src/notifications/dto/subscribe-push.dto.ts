import { IsObject, IsOptional, IsString, IsNotEmpty } from 'class-validator';

/** A böngésző PushManager feliratkozása (endpoint + kulcsok). */
export class SubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  /** { p256dh, auth } – a service-ben ellenőrizzük a mezőket. */
  @IsObject()
  keys!: { p256dh?: string; auth?: string };

  @IsOptional()
  @IsString()
  userAgent?: string;
}
