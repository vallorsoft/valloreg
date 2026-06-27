import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { MatchingModule } from '../matching/matching.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { SpreadsheetParserService } from './spreadsheet/spreadsheet-parser.service';
import { SpreadsheetImportService } from './spreadsheet/spreadsheet-import.service';

@Module({
  imports: [QueueModule, MatchingModule, ExtractionModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, SpreadsheetParserService, SpreadsheetImportService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
