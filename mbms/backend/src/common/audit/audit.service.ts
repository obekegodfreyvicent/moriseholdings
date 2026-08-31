import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'access_denied';

export interface RecordAuditEventInput {
  eventType: string; // e.g. "employee.record.created" — mirrors the Kafka topic name the approved architecture would use for this event
  sourceService: string; // e.g. "employee-service" — which module raised it
  userId?: string | null;
  companyId?: string | null;
  entityType: string; // e.g. "employee"
  entityId?: string | null;
  action: AuditAction;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

/**
 * FR-AUDIT-01: every service calls record() directly and synchronously
 * instead of publishing to Kafka for an Audit & Reporting Service to
 * consume (07_System Design Document v2.0, Section 9) — there is no Kafka
 * in this proof-of-concept. The eventType/sourceService fields are kept
 * even though nothing consumes them as a topic name today, so the shape
 * matches what a real Kafka payload (09_API Specification, Section 11)
 * would carry, minimizing rework if this is later split into a genuine
 * publish/consume pair.
 *
 * Failures here are logged, never thrown — a broken audit write must not
 * block the business operation that triggered it (matching what a
 * fire-and-forget Kafka publish would do in the approved architecture).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          eventType: input.eventType,
          sourceService: input.sourceService,
          userId: input.userId ?? null,
          companyId: input.companyId ?? null,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          action: input.action,
          previousValue: input.previousValue as any,
          newValue: input.newValue as any,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to record audit event "${input.eventType}"`, err as Error);
    }
  }
}
