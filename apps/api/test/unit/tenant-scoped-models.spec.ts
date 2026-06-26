import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A multi-tenancy LEGFONTOSABB karbantartási invariánsa (lásd CLAUDE.md):
 * minden ÜZLETI (tenant-scope-olt) modellnek van `tenantId` mezője + `@@index([tenantId])`,
 * ÉS szerepel a `TENANT_SCOPED_MODELS` halmazban a prisma.service.ts-ben.
 *
 * Ez a teszt a `schema.prisma`-t és a `prisma.service.ts`-t SZÖVEGKÉNT veti össze
 * (nincs szükség generált @prisma/client-re), ezért unit szinten fut. Megfogja a
 * klasszikus hibát: „új modellt vettem fel tenantId-vel, de elfelejtettem a halmazba".
 *
 * SZÁNDÉKOS kivételek (tenantId-juk van, de NEM scope-oltak):
 *  - AuditLog       – a guardok/rendszer írja, cross-tenant olvasás az admin nézethez.
 *  - PushSubscription – a NotificationsService mindig a `prisma.system`-en kezeli.
 * Ha ide új kivétel kerül, azt TUDATOSAN, itt kell felvenni.
 */
const INTENTIONALLY_UNSCOPED = new Set(['AuditLog', 'PushSubscription']);

const API_ROOT = join(__dirname, '..', '..');
const SCHEMA_PATH = join(API_ROOT, 'prisma', 'schema.prisma');
const PRISMA_SERVICE_PATH = join(API_ROOT, 'src', 'prisma', 'prisma.service.ts');

interface ModelInfo {
  name: string;
  hasTenantId: boolean;
  hasTenantIndex: boolean;
}

/** A schema.prisma model-blokkjainak kinyerése (a Prisma model-törzs nem tartalmaz `}`-t). */
function parseModels(schema: string): ModelInfo[] {
  const models: ModelInfo[] = [];
  const re = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(schema)) !== null) {
    const name = m[1]!;
    const body = m[2]!;
    models.push({
      name,
      // A `tenantId String` SKALÁR mező (nem a `tenant Tenant @relation`, és nem a
      // `@@index([tenantId])` / `@relation(fields: [tenantId])` előfordulások).
      hasTenantId: /\btenantId\s+String/.test(body),
      hasTenantIndex: /@@index\(\[tenantId/.test(body),
    });
  }
  return models;
}

/** A TENANT_SCOPED_MODELS halmaz string-literáljainak kinyerése a prisma.service.ts-ből. */
function parseScopedSet(source: string): Set<string> {
  const block = /TENANT_SCOPED_MODELS\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/.exec(source);
  if (!block) throw new Error('TENANT_SCOPED_MODELS halmaz nem található a prisma.service.ts-ben.');
  const names = [...block[1]!.matchAll(/'([A-Za-z]\w*)'/g)].map((x) => x[1]!);
  return new Set(names);
}

describe('TENANT_SCOPED_MODELS ↔ schema.prisma konzisztencia', () => {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const source = readFileSync(PRISMA_SERVICE_PATH, 'utf8');

  const models = parseModels(schema);
  const tenantIdModels = models.filter((m) => m.hasTenantId).map((m) => m.name);
  const scoped = parseScopedSet(source);

  it('a parse értelmes adatot ad (sanity)', () => {
    expect(models.length).toBeGreaterThan(10);
    expect(scoped.size).toBeGreaterThan(10);
    expect(tenantIdModels).toContain('Vehicle');
  });

  it('minden scope-olt modellnek LÉTEZIK tenantId-s sémamodellje', () => {
    const missing = [...scoped].filter((name) => !tenantIdModels.includes(name));
    expect(missing).toEqual([]);
  });

  it('minden scope-olt modellnek van @@index([tenantId])-e', () => {
    const byName = new Map(models.map((m) => [m.name, m]));
    const noIndex = [...scoped].filter((name) => !byName.get(name)?.hasTenantIndex);
    expect(noIndex).toEqual([]);
  });

  it('minden tenantId-s modell vagy scope-olt, vagy SZÁNDÉKOSAN kivétel', () => {
    // Ez fogja meg: új tenantId-s modell, ami kimaradt a TENANT_SCOPED_MODELS-ből.
    const unaccounted = tenantIdModels.filter(
      (name) => !scoped.has(name) && !INTENTIONALLY_UNSCOPED.has(name),
    );
    expect(unaccounted).toEqual([]);
  });

  it('a szándékos kivétel-lista nem áporodott (mind létező, tenantId-s, nem-scope-olt modell)', () => {
    for (const name of INTENTIONALLY_UNSCOPED) {
      expect(tenantIdModels).toContain(name);
      expect(scoped.has(name)).toBe(false);
    }
  });
});
