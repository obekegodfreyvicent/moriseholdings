import { Module } from '@nestjs/common';
import { AuditTrailController } from './audit-trail.controller';

@Module({
  controllers: [AuditTrailController],
})
export class AuditTrailModule {}
