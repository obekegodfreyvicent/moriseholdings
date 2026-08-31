import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TicketCategory, TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @IsEnum(TicketCategory)
  category!: TicketCategory;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsString()
  @MaxLength(255)
  subject!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsUUID()
  relatedOrderId?: string;

  @IsOptional()
  @IsUUID()
  relatedInvoiceId?: string;
}
