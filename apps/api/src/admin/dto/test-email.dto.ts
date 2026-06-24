import { IsEmail } from 'class-validator';

/** Teszt-email célcíme (Brevo-konfiguráció ellenőrzéséhez, csak Super Admin). */
export class TestEmailDto {
  @IsEmail()
  to!: string;
}
