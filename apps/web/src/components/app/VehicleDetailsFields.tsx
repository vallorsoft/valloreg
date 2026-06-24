'use client';

import { useTranslations } from 'next-intl';
import { ALL_FLEET_SEGMENTS } from '@valloreg/shared';
import { Input } from '@/components/ui/Input';
import type {
  CreateVehiclePayload,
  Vehicle,
  VehicleRegistrationDraft,
  VehiclePartyType,
} from '@/lib/api';

/** Egy fél (tulajdonos / üzembentartó) szerkeszthető állapota. */
export interface PartyState {
  partyType: VehiclePartyType;
  name: string;
  address: string;
  idNumber: string;
}

/** A bővebb műszaki adatok + a két fél szerkeszthető állapota. */
export interface VehicleExtraState {
  vehicleType: string;
  firstRegistration: string; // YYYY-MM-DD
  category: string;
  /** Flotta-szegmens kézi felülírás ('' = automatikus, a forgalmiból levezetve). */
  fleetSegment: string;
  fuelType: string;
  engineCm3: string;
  powerKw: string;
  color: string;
  seats: string;
  maxMassKg: string;
  kerbWeightKg: string;
  euroClass: string;
  typeApproval: string;
  owner: PartyState;
  user: PartyState;
}

const emptyParty = (): PartyState => ({
  partyType: 'person',
  name: '',
  address: '',
  idNumber: '',
});

export function emptyExtraState(): VehicleExtraState {
  return {
    vehicleType: '',
    firstRegistration: '',
    category: '',
    fleetSegment: '',
    fuelType: '',
    engineCm3: '',
    powerKw: '',
    color: '',
    seats: '',
    maxMassKg: '',
    kerbWeightKg: '',
    euroClass: '',
    typeApproval: '',
    owner: emptyParty(),
    user: emptyParty(),
  };
}

const str = (v: unknown): string => (v == null ? '' : String(v));
const partyType = (v: string | null): VehiclePartyType =>
  v === 'company' ? 'company' : 'person';

/** Meglévő jármű → szerkeszthető állapot (felek a parties tömbből, szerep szerint). */
export function extraStateFromVehicle(v: Vehicle): VehicleExtraState {
  const owner = v.parties?.find((p) => p.role === 'owner');
  const user = v.parties?.find((p) => p.role === 'user');
  return {
    vehicleType: str(v.vehicleType),
    firstRegistration: v.firstRegistration ? v.firstRegistration.slice(0, 10) : '',
    category: str(v.category),
    fleetSegment: str(v.fleetSegment),
    fuelType: str(v.fuelType),
    engineCm3: str(v.engineCm3),
    powerKw: str(v.powerKw),
    color: str(v.color),
    seats: str(v.seats),
    maxMassKg: str(v.maxMassKg),
    kerbWeightKg: str(v.kerbWeightKg),
    euroClass: str(v.euroClass),
    typeApproval: str(v.typeApproval),
    owner: owner
      ? { partyType: owner.partyType, name: str(owner.name), address: str(owner.address), idNumber: str(owner.idNumber) }
      : emptyParty(),
    user: user
      ? { partyType: user.partyType, name: str(user.name), address: str(user.address), idNumber: str(user.idNumber) }
      : emptyParty(),
  };
}

/** Kiolvasott draft → szerkeszthető állapot. */
export function extraStateFromDraft(d: VehicleRegistrationDraft): VehicleExtraState {
  return {
    vehicleType: str(d.vehicleType),
    firstRegistration: d.firstRegistration ? d.firstRegistration.slice(0, 10) : '',
    category: str(d.category),
    fleetSegment: '', // a forgalmiból nem jön; alapból automatikus levezetés
    fuelType: str(d.fuelType),
    engineCm3: str(d.engineCm3),
    powerKw: str(d.powerKw),
    color: str(d.color),
    seats: str(d.seats),
    maxMassKg: str(d.maxMassKg),
    kerbWeightKg: str(d.kerbWeightKg),
    euroClass: str(d.euroClass),
    typeApproval: str(d.typeApproval),
    owner: {
      partyType: partyType(d.ownerType),
      name: str(d.ownerName),
      address: str(d.ownerAddress),
      idNumber: str(d.ownerIdNumber),
    },
    user: {
      partyType: partyType(d.userType),
      name: str(d.userName),
      address: str(d.userAddress),
      idNumber: str(d.userIdNumber),
    },
  };
}

const numOrUndef = (v: string): number | undefined => {
  const t = v.trim();
  if (t === '') return undefined;
  const n = parseInt(t.replace(/[\s.]/g, ''), 10);
  return isNaN(n) ? undefined : n;
};
const strOrUndef = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());

/**
 * Szerkeszthető állapot → API payload-rész. A felek MINDIG szerepelnek (owner +
 * user) – üres fél a háttérben törli az adott szerepet, így a kézi törlés is megy.
 */
export function extraStateToPayload(s: VehicleExtraState): Partial<CreateVehiclePayload> {
  return {
    vehicleType: strOrUndef(s.vehicleType),
    firstRegistration: strOrUndef(s.firstRegistration),
    category: strOrUndef(s.category),
    fleetSegment: strOrUndef(s.fleetSegment),
    fuelType: strOrUndef(s.fuelType),
    engineCm3: numOrUndef(s.engineCm3),
    powerKw: numOrUndef(s.powerKw),
    color: strOrUndef(s.color),
    seats: numOrUndef(s.seats),
    maxMassKg: numOrUndef(s.maxMassKg),
    kerbWeightKg: numOrUndef(s.kerbWeightKg),
    euroClass: strOrUndef(s.euroClass),
    typeApproval: strOrUndef(s.typeApproval),
    parties: [
      {
        role: 'owner' as const,
        partyType: s.owner.partyType,
        name: strOrUndef(s.owner.name),
        address: strOrUndef(s.owner.address),
        idNumber: strOrUndef(s.owner.idNumber),
      },
      {
        role: 'user' as const,
        partyType: s.user.partyType,
        name: strOrUndef(s.user.name),
        address: strOrUndef(s.user.address),
        idNumber: strOrUndef(s.user.idNumber),
      },
    ],
  };
}

interface Props {
  value: VehicleExtraState;
  onChange: (next: VehicleExtraState) => void;
  /** Bizonytalan mezők (sárga keret) – a kiolvasásnál használt path-ek. */
  uncertain?: Set<string>;
}

/** A bővebb műszaki adatok + tulajdonos + üzembentartó szerkeszthető mezői. */
export function VehicleDetailsFields({ value, onChange, uncertain }: Props) {
  const t = useTranslations('vehicles.fields');
  const ts = useTranslations('vehicles.segments');

  const set = (patch: Partial<VehicleExtraState>) => onChange({ ...value, ...patch });
  const setParty = (key: 'owner' | 'user', patch: Partial<PartyState>) =>
    onChange({ ...value, [key]: { ...value[key], ...patch } });
  const mark = (path: string) =>
    uncertain?.has(path) ? 'border-amber-400' : undefined;

  return (
    <div className="space-y-5">
      {/* Műszaki adatok */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-anthracite-500">
          {t('sectionTech')}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('vehicleType')} value={value.vehicleType} onChange={(e) => set({ vehicleType: e.target.value })} />
          <Input label={t('firstRegistration')} type="date" value={value.firstRegistration} className={mark('firstRegistration')} onChange={(e) => set({ firstRegistration: e.target.value })} />
          <Input label={t('category')} value={value.category} onChange={(e) => set({ category: e.target.value })} />
          <div>
            <label className="mb-1 block text-sm font-medium text-anthracite-700">
              {t('fleetSegment')}
            </label>
            <select
              className="h-11 w-full rounded-xl border border-anthracite-200 bg-white px-3.5 text-sm text-anthracite-900 focus:border-primary-500 focus:outline-none"
              value={value.fleetSegment}
              onChange={(e) => set({ fleetSegment: e.target.value })}
            >
              <option value="">{t('fleetSegmentAuto')}</option>
              {ALL_FLEET_SEGMENTS.map((seg) => (
                <option key={seg} value={seg}>
                  {ts(seg)}
                </option>
              ))}
            </select>
          </div>
          <Input label={t('fuelType')} value={value.fuelType} onChange={(e) => set({ fuelType: e.target.value })} />
          <Input label={t('engineCm3')} type="number" value={value.engineCm3} onChange={(e) => set({ engineCm3: e.target.value })} />
          <Input label={t('powerKw')} type="number" value={value.powerKw} onChange={(e) => set({ powerKw: e.target.value })} />
          <Input label={t('color')} value={value.color} onChange={(e) => set({ color: e.target.value })} />
          <Input label={t('seats')} type="number" value={value.seats} onChange={(e) => set({ seats: e.target.value })} />
          <Input label={t('maxMassKg')} type="number" value={value.maxMassKg} onChange={(e) => set({ maxMassKg: e.target.value })} />
          <Input label={t('kerbWeightKg')} type="number" value={value.kerbWeightKg} onChange={(e) => set({ kerbWeightKg: e.target.value })} />
          <Input label={t('euroClass')} value={value.euroClass} onChange={(e) => set({ euroClass: e.target.value })} />
          <Input label={t('typeApproval')} value={value.typeApproval} onChange={(e) => set({ typeApproval: e.target.value })} />
        </div>
      </div>

      <PartyBlock title={t('sectionOwner')} party={value.owner} onChange={(patch) => setParty('owner', patch)} t={t} />
      <PartyBlock title={t('sectionUser')} party={value.user} onChange={(patch) => setParty('user', patch)} t={t} />
    </div>
  );
}

function PartyBlock({
  title,
  party,
  onChange,
  t,
}: {
  title: string;
  party: PartyState;
  onChange: (patch: Partial<PartyState>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const idLabel = party.partyType === 'company' ? t('party.cui') : t('party.cnp');
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-anthracite-500">
        {title}
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-anthracite-700">
              {t('party.type')}
            </label>
            <select
              className="h-11 w-full rounded-xl border border-anthracite-200 bg-white px-3.5 text-sm text-anthracite-900 focus:border-primary-500 focus:outline-none"
              value={party.partyType}
              onChange={(e) => onChange({ partyType: e.target.value as VehiclePartyType })}
            >
              <option value="person">{t('party.person')}</option>
              <option value="company">{t('party.company')}</option>
            </select>
          </div>
          <Input label={idLabel} value={party.idNumber} onChange={(e) => onChange({ idNumber: e.target.value })} />
        </div>
        <Input label={t('party.name')} value={party.name} onChange={(e) => onChange({ name: e.target.value })} />
        <Input label={t('party.address')} value={party.address} onChange={(e) => onChange({ address: e.target.value })} />
      </div>
    </div>
  );
}
