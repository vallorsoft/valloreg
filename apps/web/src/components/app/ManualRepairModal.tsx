'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ItemCategory, ItemType } from '@valloreg/shared';
import {
  invoicesApi,
  vehiclesApi,
  ApiError,
  type Vehicle,
  type ManualInvoiceItemPayload,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useModalA11y } from '@/components/app/useModalA11y';

interface Props {
  onClose: () => void;
  /** A létrejött rekord dokumentum-azonosítójával hívódik. */
  onCreated: (documentId: string) => void;
}

/** Tétel-fajta: alkatrész / munkadíj / egyéb → (category, type) leképezés. */
type ItemKind = 'part' | 'labor' | 'other';
const KIND_MAP: Record<ItemKind, { category: string; type: string }> = {
  part: { category: ItemCategory.PART, type: ItemType.VEHICLE },
  labor: { category: ItemCategory.LABOR, type: ItemType.VEHICLE },
  other: { category: ItemCategory.OTHER, type: ItemType.GENERAL },
};

interface Row {
  kind: ItemKind;
  name: string;
  articleNumber: string;
  quantity: string;
  unitPrice: string;
}

function emptyRow(kind: ItemKind): Row {
  return { kind, name: '', articleNumber: '', quantity: '1', unitPrice: '' };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ManualRepairModal({ onClose, onCreated }: Props) {
  const t = useTranslations('documents.manual');
  const dialogRef = useModalA11y(onClose);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow('part'), emptyRow('labor')]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void vehiclesApi
      .list()
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }, []);

  function setRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addRow(kind: ItemKind) {
    setRows((prev) => [...prev, emptyRow(kind)]);
  }
  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const total = rows.reduce((sum, r) => {
    const qty = Number(r.quantity) || 0;
    const unit = Number(r.unitPrice) || 0;
    return sum + qty * unit;
  }, 0);

  const validRows = rows.filter((r) => r.name.trim().length > 0);

  async function handleSubmit() {
    if (validRows.length === 0) {
      setError(t('errorNoItems'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const items: ManualInvoiceItemPayload[] = validRows.map((r) => ({
        name: r.name.trim(),
        category: KIND_MAP[r.kind].category,
        type: KIND_MAP[r.kind].type,
        articleNumber: r.articleNumber.trim() || null,
        quantity: Number(r.quantity) || 1,
        unitPrice: Number(r.unitPrice) || 0,
      }));
      const result = await invoicesApi.createManual({
        vehicleId: vehicleId || null,
        date,
        supplier: supplier.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        odometerKm: odometerKm ? Number(odometerKm) : undefined,
        title: t('recordTitle', { date }),
        items,
      });
      onCreated(result.documentId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setBusy(false);
    }
  }

  function vehicleLabel(v: Vehicle): string {
    return [v.plate, [v.make, v.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  }

  const selectClass =
    'h-11 w-full rounded-xl border border-anthracite-200 bg-white px-3 text-sm ' +
    'text-anthracite-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-anthracite-900/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-repair-title"
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-hover focus:outline-none"
      >
        <h2 id="manual-repair-title" className="mb-1 text-lg font-semibold text-anthracite-900">
          {t('title')}
        </h2>
        <p className="mb-4 text-sm text-anthracite-500">{t('subtitle')}</p>

        {/* Fejléc-mezők */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="manual-vehicle"
              className="block text-sm font-medium text-anthracite-700"
            >
              {t('vehicle')}
            </label>
            <select
              id="manual-vehicle"
              className={selectClass}
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              <option value="">{t('noVehicle')}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {vehicleLabel(v)}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t('date')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label={t('supplier')}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder={t('supplierPlaceholder')}
          />
          <Input
            label={t('odometer')}
            type="number"
            inputMode="numeric"
            value={odometerKm}
            onChange={(e) => setOdometerKm(e.target.value)}
          />
        </div>

        {/* Tételek */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-anthracite-800">{t('items')}</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => addRow('part')}>
                {t('addPart')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => addRow('labor')}>
                {t('addLabor')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-12 items-end gap-2 rounded-xl border border-anthracite-100 p-2"
              >
                <div className="col-span-3">
                  <label className="mb-1 block text-xs text-anthracite-500">{t('kind')}</label>
                  <select
                    className={selectClass}
                    value={r.kind}
                    onChange={(e) => setRow(i, { kind: e.target.value as ItemKind })}
                  >
                    <option value="part">{t('kindPart')}</option>
                    <option value="labor">{t('kindLabor')}</option>
                    <option value="other">{t('kindOther')}</option>
                  </select>
                </div>
                <div className="col-span-4">
                  <Input
                    label={t('itemName')}
                    value={r.name}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={t('articleNumber')}
                    value={r.articleNumber}
                    disabled={r.kind !== 'part'}
                    onChange={(e) => setRow(i, { articleNumber: e.target.value })}
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    label={t('qty')}
                    type="number"
                    inputMode="decimal"
                    value={r.quantity}
                    onChange={(e) => setRow(i, { quantity: e.target.value })}
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    label={t('unitPrice')}
                    type="number"
                    inputMode="decimal"
                    value={r.unitPrice}
                    onChange={(e) => setRow(i, { unitPrice: e.target.value })}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    aria-label={t('removeRow')}
                    className="h-11 px-2 text-red-500 hover:text-red-700"
                    onClick={() => removeRow(i)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-medium text-anthracite-700">
            {t('total', { total: total.toFixed(2) })}
          </span>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={busy || validRows.length === 0}
              onClick={() => void handleSubmit()}
            >
              {busy ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
