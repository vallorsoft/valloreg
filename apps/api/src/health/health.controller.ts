import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
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
   * és kiveszi-e a worker. Publikus (csak aggregált számokat ad vissza).
   */
  @Public()
  @Get('queues')
  queues() {
    return this.healthService.queueStats();
  }
}
