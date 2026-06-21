/**
 * Prisma seed – idempotens (upsertekkel). Futtatás:
 *   pnpm --filter @valloreg/api prisma:seed
 *
 * Létrehoz:
 *  - egy platform super-admint (isPlatformAdmin),
 *  - egy "Demo Fuvar Kft." céget OWNER felhasználóval
 *    (demo@valloreg.local / Demo1234!),
 *  - PROFESSIONAL / ACTIVE előfizetést,
 *  - 2 járművet,
 *  - 1 minta Document + Invoice + tételek (AUTO_OK).
 *
 * A jelszavak argon2 hash-sel készülnek. A seed a sima (nem scope-olt)
 * PrismaClient-et használja, a tenantId-t expliciten adja meg.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminPasswordHash = await argon2.hash('SuperAdmin123!');
  const demoPasswordHash = await argon2.hash('Demo1234!');

  // ── Platform super-admin (globális, nincs tenant tagság) ─────────────────
  await prisma.user.upsert({
    where: { email: 'admin@valloreg.local' },
    update: { isPlatformAdmin: true },
    create: {
      email: 'admin@valloreg.local',
      passwordHash: adminPasswordHash,
      name: 'Platform Super Admin',
      isPlatformAdmin: true,
    },
  });

  // ── Demo cég OWNER felhasználóval ────────────────────────────────────────
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@valloreg.local' },
    update: {},
    create: {
      email: 'demo@valloreg.local',
      passwordHash: demoPasswordHash,
      name: 'Demo Tulajdonos',
    },
  });

  // A Tenant-nek nincs természetes egyedi kulcsa a név mellett – deduplikációhoz
  // megkeressük név alapján, és csak ha nincs, hozzuk létre.
  let tenant = await prisma.tenant.findFirst({
    where: { name: 'Demo Fuvar Kft.' },
  });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Demo Fuvar Kft.',
        taxNumber: '12345678-2-42',
        contactName: 'Demo Tulajdonos',
        email: 'demo@valloreg.local',
        phone: '+36 1 234 5678',
      },
    });
  }

  await prisma.membership.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: demoUser.id },
    },
    update: { role: 'OWNER' },
    create: {
      tenantId: tenant.id,
      userId: demoUser.id,
      role: 'OWNER',
    },
  });

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: { planTier: 'PROFESSIONAL', status: 'ACTIVE' },
    create: {
      tenantId: tenant.id,
      planTier: 'PROFESSIONAL',
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // ── 2 jármű ──────────────────────────────────────────────────────────────
  const vehicle1 = await ensureVehicle(tenant.id, 'ABC-123', {
    vin: 'WDB1234567890ABCD',
    make: 'Mercedes-Benz',
    model: 'Actros',
    year: 2020,
    odometerKm: 152340,
  });
  await ensureVehicle(tenant.id, 'XYZ-789', {
    vin: 'WVW9876543210ZYXW',
    make: 'Volkswagen',
    model: 'Crafter',
    year: 2022,
    odometerKm: 64210,
  });

  // ── Beszállító ────────────────────────────────────────────────────────────
  let supplier = await prisma.supplier.findFirst({
    where: { tenantId: tenant.id, normalizedName: 'autoszerviz kft' },
  });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: 'Autószerviz Kft.',
        normalizedName: 'autoszerviz kft',
      },
    });
  }

  // ── Minta dokumentum + számla + tételek ───────────────────────────────────
  const sampleSha = 'demo-sha256-0000000000000000000000000000000000000001';
  let document = await prisma.document.findFirst({
    where: { tenantId: tenant.id, sha256: sampleSha },
  });
  if (!document) {
    document = await prisma.document.create({
      data: {
        tenantId: tenant.id,
        uploadedById: demoUser.id,
        fileName: 'minta-szamla.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 102400,
        storageKey: `tenants/${tenant.id}/documents/demo/minta-szamla.pdf`,
        sha256: sampleSha,
        status: 'AUTO_OK',
      },
    });
  }

  const existingInvoice = await prisma.invoice.findUnique({
    where: { documentId: document.id },
  });
  if (!existingInvoice) {
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        documentId: document.id,
        supplierId: supplier.id,
        invoiceNumber: 'SZ-2026-0001',
        date: new Date('2026-06-15'),
        currency: 'HUF',
        odometerKm: 152340,
        netTotal: 48500,
        taxTotal: 13095,
        grossTotal: 61595,
        confidence: 0.85,
      },
    });

    await prisma.invoiceItem.createMany({
      data: [
        {
          tenantId: tenant.id,
          invoiceId: invoice.id,
          name: 'Fékbetét csere (első)',
          category: 'part',
          partType: 'brakes',
          type: 'vehicle',
          vehicleId: vehicle1.id,
          quantity: 2,
          unitPrice: 9000,
          price: 18000,
          confidence: 0.88,
        },
        {
          tenantId: tenant.id,
          invoiceId: invoice.id,
          name: 'Olajcsere 5W30 motorolaj',
          category: 'consumable',
          partType: 'fluids',
          type: 'vehicle',
          vehicleId: vehicle1.id,
          quantity: 4,
          unitPrice: 3000,
          price: 12000,
          confidence: 0.86,
        },
        {
          tenantId: tenant.id,
          invoiceId: invoice.id,
          name: 'Munkadíj',
          category: 'labor',
          partType: null,
          type: 'vehicle',
          vehicleId: vehicle1.id,
          quantity: 1,
          unitPrice: 15000,
          price: 15000,
          confidence: 0.9,
        },
      ],
    });
  }

  console.log('Seed kész.');
  console.log(`  Super admin: admin@valloreg.local / SuperAdmin123!`);
  console.log(`  Demo owner:  demo@valloreg.local / Demo1234!`);
  console.log(`  Tenant id:   ${tenant.id}`);
}

async function ensureVehicle(
  tenantId: string,
  plate: string,
  data: {
    vin: string;
    make: string;
    model: string;
    year: number;
    odometerKm: number;
  },
) {
  const existing = await prisma.vehicle.findFirst({
    where: { tenantId, plate },
  });
  if (existing) return existing;
  return prisma.vehicle.create({
    data: { tenantId, plate, ...data },
  });
}

main()
  .catch((err) => {
    console.error('Seed hiba:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
