import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../exceptions/app.exception';
import type { AuthenticatedRequest } from '../types/request-context';

/**
 * Előfizetés-állapot guard. Az aktív tenant előfizetését tölti be (a scoped
 * kliensen át, tenant kontextusban – mint a billing/feature-flags service) és
 * KONZERVATÍVAN tilt: csak akkor dob, ha az állapot CANCELED vagy PAST_DUE, VAGY
 * a próbaidőszak (TRIALING) lejárt (trialEndsAt < most). ACTIVE és érvényes
 * (le nem járt) TRIALING ÁTMEGY.
 *
 * Csak ERŐFORRÁS-FOGYASZTÓ ÍRÓ végpontokra szabad tenni (pl. dokumentum-feltöltés,
 * jármű létrehozás/scan). SOHA ne kerüljön billing/auth vagy olvasó végpontra –
 * a felhasználó lejárt/felfüggesztett előfizetéssel is be tud lépni, böngészni és
 * fizetni. A TenantGuard UTÁN fut (a request.tenant-re és a scoped kliensre
 * támaszkodik).
 *
 * Alkalmazás (a controllert birtokló agensnek):
 *   import { SubscriptionGuard } from '../common/guards/subscription.guard';
 *   // jármű létrehozás/scan végpontra (apps/api/src/vehicles/vehicles.controller.ts),
 *   // a már meglévő guardok MÖGÉ fűzve, METÓDUS-szinten (NE az osztály egészére,
 *   // hogy az olvasó GET-ek ne tiltódjanak):
 *   @Post()                       // create
 *   @UseGuards(SubscriptionGuard)
 *   ...
 *   @Post('scan')                 // scan
 *   @UseGuards(SubscriptionGuard)
 *   ...
 *   @Post('scan/confirm')         // scan confirm (jármű mentés)
 *   @UseGuards(SubscriptionGuard)
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.tenant) {
      throw AppException.tenantAccessDenied();
    }

    const subscription = await this.prisma.scoped.subscription.findFirst({
      select: { status: true, trialEndsAt: true },
    });

    // Nincs előfizetés-rekord: konzervatívan átengedjük (nem ez a guard dolga
    // előfizetést kikényszeríteni; a hiányt máshol kezeljük).
    if (!subscription) {
      return true;
    }

    const { status, trialEndsAt } = subscription;

    if (
      status === SubscriptionStatus.CANCELED ||
      status === SubscriptionStatus.PAST_DUE
    ) {
      throw AppException.forbidden(
        'Az előfizetésed nem aktív. Új művelethez rendezd az előfizetést.',
      );
    }

    if (
      status === SubscriptionStatus.TRIALING &&
      trialEndsAt &&
      trialEndsAt.getTime() < Date.now()
    ) {
      throw AppException.forbidden(
        'A próbaidőszakod lejárt. Új művelethez fizess elő.',
      );
    }

    return true;
  }
}
