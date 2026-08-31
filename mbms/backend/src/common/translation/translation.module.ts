import { Global, Module } from '@nestjs/common';
import { ContentTranslationService } from './content-translation.service';

// Global so any module (customer-portal read/write paths, and staff modules
// that surface customer-authored text) can inject ContentTranslationService
// without importing this module explicitly — the same pattern PrismaModule
// and AuditModule already use.
@Global()
@Module({
  providers: [ContentTranslationService],
  exports: [ContentTranslationService],
})
export class TranslationModule {}
