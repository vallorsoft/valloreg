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
        select: { slug: true },
      });
      const existingSlugs = new Set(existing.map((d) => d.slug));
      const missing = LEGAL_SEED_DOCS.filter((d) => !existingSlugs.has(d.slug));

      if (missing.length === 0) {
        return;
      }

      const result = await this.prisma.system.legalDocument.createMany({
        data: missing.map((doc) => ({
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

      this.logger.log(
        `Jogi dokumentumok seedelve: ${result.count} új (összes seed: ${LEGAL_SEED_DOCS.length}).`,
      );
    } catch (err) {
      // A boot nem bukhat el a seed miatt (pl. a tábla még nem migrált).
      this.logger.warn(`A jogi dokumentumok seedelése kihagyva: ${(err as Error).message}`);
    }
  }
}
