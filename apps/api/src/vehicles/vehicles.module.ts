import { Module } from '@nestjs/common';
import { OcrModule } from '../ocr/ocr.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { VerificationModule } from '../verification/verification.module';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';

@Module({
  imports: [OcrModule, ExtractionModule, VerificationModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
