import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { VerificationModule } from '../verification/verification.module';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';

/**
 * A forgalmi-beolvasás aszinkron: a service a QueueModule producer-ét
 * (VehicleScansQueueService) használja, a tényleges OCR+AI a queue workerében
 * fut. A VerificationModule a megfelelőség-ellenőrzéshez (ITP/RCA) kell.
 */
@Module({
  imports: [QueueModule, VerificationModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
