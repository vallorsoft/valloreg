import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { LegalService } from './legal.service';

/**
 * Publikus jogi végpontok (auth NÉLKÜL). Csak a `isPublic=true` dokumentumokat
 * szolgálja ki – a belső dokumentumok 404-et adnak.
 */
@Controller('legal')
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  /** A publikus dokumentumok kategóriánként (a landing „Legal" oldalhoz). */
  @Public()
  @Get()
  list() {
    return this.legal.listPublic();
  }

  /** Egy publikus dokumentum teljes tartalma. */
  @Public()
  @Get(':slug')
  getOne(@Param('slug') slug: string) {
    return this.legal.getPublic(slug);
  }
}
