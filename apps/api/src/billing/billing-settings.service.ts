import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';

/** Effektív (megjelenítendő/használandó) számla-/utalási adatok. */
export interface EffectiveBillingSettings {
  companyName: string;
  taxNumber: string;
  address: string;
  beneficiary: string;
  iban: string;
  bankName: string;
  swift: string;
  notifyEmail: string;
}

/** Részleges frissítés (a Super Admin űrlapjáról). */
export type BillingSettingsUpdate = Partial<EffectiveBillingSettings>;

const SINGLETON_ID = 'default';

/**
 * Platform-szintű számla-/utalási adatok kezelése. CSAK a Super Admin (developer)
 * szerkeszti; a rendszer ezt teszi az előfizetés-igénylő e-mailbe.
 *
 * Az EFFEKTÍV érték: a DB-ben tárolt sor, ahol az ÜRES mezők az env-tartalékra
 * (BANK_TRANSFER_*, BILLING_NOTIFY_EMAIL) esnek vissza. Így a meglévő env-alapú
 * működés visszamenőleg kompatibilis marad.
 */
@Injectable()
export class BillingSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /** A ténylegesen használt adatok (DB ∪ env-tartalék). */
  async getEffective(): Promise<EffectiveBillingSettings> {
    const row = await this.prisma.system.billingSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    const env = this.config.bankTransfer;
    const pick = (dbVal: string | undefined, envVal: string) =>
      dbVal && dbVal.trim() !== '' ? dbVal : envVal;

    return {
      companyName: row?.companyName ?? '',
      taxNumber: row?.taxNumber ?? '',
      address: row?.address ?? '',
      beneficiary: pick(row?.beneficiary, env.beneficiary),
      iban: pick(row?.iban, env.iban),
      bankName: pick(row?.bankName, env.bank),
      swift: pick(row?.swift, env.swift),
      notifyEmail: pick(row?.notifyEmail, env.notifyEmail),
    };
  }

  /** A singleton sor frissítése (csak a megadott mezők). */
  async update(dto: BillingSettingsUpdate): Promise<EffectiveBillingSettings> {
    const data = {
      companyName: dto.companyName,
      taxNumber: dto.taxNumber,
      address: dto.address,
      beneficiary: dto.beneficiary,
      iban: dto.iban,
      bankName: dto.bankName,
      swift: dto.swift,
      notifyEmail: dto.notifyEmail,
    };
    await this.prisma.system.billingSettings.upsert({
      where: { id: SINGLETON_ID },
      update: data,
      create: { id: SINGLETON_ID, ...data },
    });
    return this.getEffective();
  }
}
