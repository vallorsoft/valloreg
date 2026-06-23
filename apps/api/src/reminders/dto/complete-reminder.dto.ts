import { IsInt, IsISO8601, IsOptional, Min } from 'class-validator';

/**
 * Emlékeztető "elvégezve" jelölése. Ha van intervallum (idő/km), a service
 * előregördíti a következő esedékességet a megadott (vagy aktuális) dátum/km
 * alapján.
 */
export class CompleteReminderDto {
  /** Az elvégzés dátuma (alapértelmezés: most). */
  @IsOptional()
  @IsISO8601()
  doneAt?: string;

  /** A jármű km-állása az elvégzéskor (a következő km-esedékességhez). */
  @IsOptional()
  @IsInt()
  @Min(0)
  doneKm?: number;
}
