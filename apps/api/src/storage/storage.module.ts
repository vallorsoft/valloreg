import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { MailerService } from './mailer.service';

/**
 * Globális infrastruktúra-modul: objektumtár (S3) + mailer.
 */
@Global()
@Module({
  providers: [StorageService, MailerService],
  exports: [StorageService, MailerService],
})
export class StorageModule {}
