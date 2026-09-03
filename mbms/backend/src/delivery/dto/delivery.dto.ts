import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// Delivery (31 August 2026) — Morise Logistics Ltd. See src/delivery and
// docx/19 (Clearing, Forwarding & Logistics) / the source spec
// docx/Delivery-Software-Feature-Specification.docx.

export const DELIVERY_KINDS = ['goods', 'invoice'] as const;
export const DELIVERY_PROOF_TYPES = ['none', 'signature', 'photo', 'otp'] as const;
// Statuses a dispatcher can move a delivery to via POST /delivery/:id/status
// (delivered / failed / cancelled have their own dedicated endpoints so the
// proof / reason payload is mandatory there).
export const DELIVERY_ADVANCE_STATUSES = ['assigned', 'picked_up', 'in_transit'] as const;

export class CreateDeliveryDriverDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  vehicleReg?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleType?: string;
}

export class UpdateDeliveryDriverDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  vehicleReg?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleType?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateDeliveryDto {
  // The subsidiary running the delivery — normally Morise Logistics Ltd.
  @IsUUID()
  companyId: string;

  // Deliver an order's goods (pass orderId) or an invoice/statement
  // (pass invoiceId). kind is inferred when omitted.
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsIn(DELIVERY_KINDS)
  kind?: (typeof DELIVERY_KINDS)[number];

  // Required only when neither orderId nor invoiceId is given.
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  originBranchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dropAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  dropContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  dropContactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;
}

export class AssignDriverDto {
  @IsUUID()
  driverId: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AdvanceDeliveryStatusDto {
  @IsIn(DELIVERY_ADVANCE_STATUSES)
  status: (typeof DELIVERY_ADVANCE_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ProofOfDeliveryDto {
  @IsIn(['signature', 'photo', 'otp'])
  proofType: 'signature' | 'photo' | 'otp';

  @IsString()
  @MaxLength(160)
  recipientName: string;

  // The OTP entered, the signature-capture note, or the photo caption /
  // stored-evidence reference — a string in this slice (no file upload).
  @IsOptional()
  @IsString()
  @MaxLength(300)
  proofReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class FailDeliveryDto {
  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationText?: string;
}

export class CancelDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// Customer acknowledgement of a completed delivery (3 September 2026).
// POST /api/v1/customer-portal/orders/:id/delivery/acknowledge
export const DELIVERY_ACK_CONDITIONS = ['good', 'damaged', 'incomplete', 'not_received'] as const;

export class AcknowledgeDeliveryDto {
  @IsIn(DELIVERY_ACK_CONDITIONS)
  condition: (typeof DELIVERY_ACK_CONDITIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  recipientName?: string;
}
