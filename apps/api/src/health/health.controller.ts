import { Controller, Get, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness/readiness – publikus, hitelesítés nélkül. */
  @Public()
  @Get()
  check() {
    return this.healthService.check();
  }

  /**
   * Diagnosztika: a BullMQ sorok tényleges állapota (waiting/active/completed/
   * failed/…) mindkét queue-ra. Megmutatja, hogy a job egyáltalán sorba kerül-e,
   * és kiveszi-e a worker. NEM publikus: belső BullMQ-állapotot szivárogtat, ezért
   * csak platform (Super Admin) érheti el.
   */
  @Get('queues')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  queues() {
    return this.healthService.queueStats();
  }
}
