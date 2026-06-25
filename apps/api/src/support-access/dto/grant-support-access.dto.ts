import { IsEmail, IsIn } from 'class-validator';

/**
 * Ideiglenes, auditált support-hozzáférés megadása egy céghez.
 *
 * `duration` – a hozzáférés élettartama (1 óra / 24 óra / 7 nap).
 * `grantedToEmail` – KÖTELEZŐ: a megnevezett support-személy, aki a grant-et
 * használhatja (az ő email címére szól a hozzáférés).
 */
export class GrantSupportAccessDto {
  @IsIn(['1h', '24h', '7d'])
  duration!: '1h' | '24h' | '7d';

  @IsEmail()
  grantedToEmail!: string;
}
