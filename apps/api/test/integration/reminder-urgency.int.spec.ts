import {
  ReminderStatus,
  REMINDER_DUE_SOON_DAYS,
  REMINDER_DUE_SOON_KM,
} from '@valloreg/shared';
import { RemindersService } from '../../src/reminders/reminders.service';

/**
 * A `RemindersService.evaluate` STATIKUS és TISZTA: a határidő / km-állás
 * alapján sürgősségi állapotot számol. NEM kell hozzá DB, connect vagy
 * service-példány.
 *
 * Ez azért az `integration` projektbe (`*.int.spec.ts`) kerül, mert a
 * `RemindersService` importja tranzitívan behúzza a generált `@prisma/client`-et,
 * ami csak a CI-ban áll rendelkezésre. MAGÁHOZ az `evaluate`-hez nem nyúl semmi
 * DB-állapothoz.
 *
 * Minden eset FIX `now`-t ad meg a determinizmusért, és a küszöböket a
 * `@valloreg/shared` konstansaiból számolja (nincs hardcode-olt érték).
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-06-26T00:00:00Z');

/** `now`-hoz képest `days` nappal eltolt dátum. */
const datePlusDays = (days: number): Date => new Date(now.getTime() + days * DAY_MS);

describe('RemindersService.evaluate – sürgősség-számítás (integráció)', () => {
  describe('dátum-alapú emlékeztetők', () => {
    it('OK, ha a határidő jóval a jövőben van és nincs km-cél', () => {
      const result = RemindersService.evaluate(
        { dueDate: datePlusDays(REMINDER_DUE_SOON_DAYS + 30), dueOdometerKm: null },
        null,
        now,
      );

      expect(result.status).toBe(ReminderStatus.OK);
      expect(result.daysRemaining).not.toBeNull();
      expect(result.daysRemaining!).toBeGreaterThan(REMINDER_DUE_SOON_DAYS);
      expect(result.kmRemaining).toBeNull();
    });

    it('DUE_SOON, ha a határidő pontosan a küszöbön belül van', () => {
      const result = RemindersService.evaluate(
        { dueDate: datePlusDays(REMINDER_DUE_SOON_DAYS), dueOdometerKm: null },
        null,
        now,
      );

      expect(result.status).toBe(ReminderStatus.DUE_SOON);
      expect(result.daysRemaining).toBe(REMINDER_DUE_SOON_DAYS);
      expect(result.kmRemaining).toBeNull();
    });

    it('OVERDUE, ha a határidő a múltban van (daysRemaining < 0)', () => {
      const result = RemindersService.evaluate(
        { dueDate: datePlusDays(-5), dueOdometerKm: null },
        null,
        now,
      );

      expect(result.status).toBe(ReminderStatus.OVERDUE);
      expect(result.daysRemaining).not.toBeNull();
      expect(result.daysRemaining!).toBeLessThan(0);
    });
  });

  describe('km-alapú emlékeztetők', () => {
    it('DUE_SOON, ha a hátralévő km a küszöbön belül, de pozitív', () => {
      const odometerKm = 100_000;
      // kmRemaining = REMINDER_DUE_SOON_KM (pozitív, a küszöbön)
      const dueOdometerKm = odometerKm + REMINDER_DUE_SOON_KM;

      const result = RemindersService.evaluate(
        { dueDate: null, dueOdometerKm },
        odometerKm,
        now,
      );

      expect(result.status).toBe(ReminderStatus.DUE_SOON);
      expect(result.kmRemaining).toBe(REMINDER_DUE_SOON_KM);
      expect(result.kmRemaining!).toBeGreaterThan(0);
      expect(result.daysRemaining).toBeNull();
    });

    it('OVERDUE, ha a hátralévő km negatív (túlhaladott)', () => {
      const odometerKm = 100_000;
      const dueOdometerKm = odometerKm - 200;

      const result = RemindersService.evaluate(
        { dueDate: null, dueOdometerKm },
        odometerKm,
        now,
      );

      expect(result.status).toBe(ReminderStatus.OVERDUE);
      expect(result.kmRemaining).toBe(-200);
      expect(result.kmRemaining!).toBeLessThan(0);
    });
  });

  describe('precedencia (overdue > due_soon > ok)', () => {
    it('OVERDUE nyer, ha a dátum OK, de a km negatív', () => {
      const odometerKm = 100_000;
      const result = RemindersService.evaluate(
        {
          dueDate: datePlusDays(REMINDER_DUE_SOON_DAYS + 30),
          dueOdometerKm: odometerKm - 100,
        },
        odometerKm,
        now,
      );

      expect(result.status).toBe(ReminderStatus.OVERDUE);
    });

    it('DUE_SOON, ha a dátum a küszöbön belül, de minden más OK', () => {
      const odometerKm = 100_000;
      const result = RemindersService.evaluate(
        {
          dueDate: datePlusDays(REMINDER_DUE_SOON_DAYS),
          // km-cél messze a jövőben → nem due_soon, nem overdue
          dueOdometerKm: odometerKm + REMINDER_DUE_SOON_KM + 5_000,
        },
        odometerKm,
        now,
      );

      expect(result.status).toBe(ReminderStatus.DUE_SOON);
    });
  });

  describe('üres / hiányzó adat', () => {
    it('OK, ha mindkét cél null (mindkét remaining null)', () => {
      const result = RemindersService.evaluate(
        { dueDate: null, dueOdometerKm: null },
        null,
        now,
      );

      expect(result.status).toBe(ReminderStatus.OK);
      expect(result.daysRemaining).toBeNull();
      expect(result.kmRemaining).toBeNull();
    });
  });

  describe('számított értékek konkrét példán', () => {
    it('daysRemaining = 10 (now + 10 nap) és kmRemaining = 1000', () => {
      const odometerKm = 99_000;
      const result = RemindersService.evaluate(
        { dueDate: datePlusDays(10), dueOdometerKm: 100_000 },
        odometerKm,
        now,
      );

      expect(result.daysRemaining).toBe(10);
      expect(result.kmRemaining).toBe(1_000);
    });
  });
});
