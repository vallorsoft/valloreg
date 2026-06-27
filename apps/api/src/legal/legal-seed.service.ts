import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LEGAL_SEED_DOCS, isSeedDocPublicByDefault } from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A jogi dokumentumok PROD-biztos, indításkori seedelése a megosztott
 * seed-forrásból (`LEGAL_SEED_DOCS`). A Render deploy nem futtatja a teljes
 * (demo-adatot is létrehozó) seedet, ezért a `legal_documents` tábla különben
 * üres maradna prodban; itt – minden boot-kor, idempotensen – pótoljuk a
 * HIÁNYZÓ dokumentumokat.
 *
 * - CSAK a hiányzó slugokat hozza létre (`createMany` + `skipDuplicates`), a
 *   meglévőket NEM írja felül → megőrzi a SuperAdmin szerkesztéseit, és nem
 *   bumpolja az `updatedAt`-ot minden induláskor.
 * - Több process (web + worker) versenyét a `skipDuplicates` kezeli.
 * - Hiba esetén NEM dob: a boot nem bukhat el a seed miatt.
 */
@Injectable()
export class LegalSeedService implements OnModuleInit {
  private readonly logger = new Logger(LegalSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      const existing = await this.prisma.system.legalDocument.findMany({
        select: { slug: true, updatedById: true },
      });
      const bySlug = new Map(existing.map((d) => [d.slug, d]));

      const toCreate = LEGAL_SEED_DOCS.filter((d) => !bySlug.has(d.slug));
      // CSAK a sosem kézzel szerkesztett (updatedById == null) seed-eredetű
      // dokumentumok tartalmát szinkronizáljuk a friss seedhez (pl. token-alapú
      // cégadatokra állás). A SuperAdmin szerkesztéseit (updatedById != null)
      // NEM írjuk felül. Az isPublic-ot sosem írjuk (megőrzi a kapcsolót).
      const toSync = LEGAL_SEED_DOCS.filter((d) => {
        const row = bySlug.get(d.slug);
        return row != null && row.updatedById == null;
      });

      if (toCreate.length > 0) {
        await this.prisma.system.legalDocument.createMany({
          data: toCreate.map((doc) => ({
            slug: doc.slug,
            category: doc.category,
            title: doc.title,
            subtitle: doc.subtitle ?? null,
            summary: doc.summary,
            updatedLabel: doc.updated,
            blocks: doc.blocks as unknown as Prisma.InputJsonValue,
            isPublic: isSeedDocPublicByDefault(doc),
          })),
          skipDuplicates: true,
        });
      }

      for (const doc of toSync) {
        await this.prisma.system.legalDocument.update({
          where: { slug: doc.slug },
          data: {
            title: doc.title,
            subtitle: doc.subtitle ?? null,
            summary: doc.summary,
            updatedLabel: doc.updated,
            blocks: doc.blocks as unknown as Prisma.InputJsonValue,
          },
        });
      }

      this.logger.log(
        `Jogi dokumentumok: ${toCreate.length} új, ${toSync.length} szinkronizálva (összes seed: ${LEGAL_SEED_DOCS.length}).`,
      );
    } catch (err) {
      // A boot nem bukhat el a seed miatt (pl. a tábla még nem migrált).
      this.logger.warn(`A jogi dokumentumok seedelése kihagyva: ${(err as Error).message}`);
    }
  }
}
