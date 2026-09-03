-- Staff Identification Card — front and back (3 September 2026). The card now
-- has a printable back face; blood_group and back_notes are the only
-- back-face fields held on the card itself (national id, emergency contact
-- and the issuer address / contact are derived at read time from the
-- Employee and the Company).
ALTER TABLE "staff_id_cards" ADD COLUMN "blood_group" VARCHAR(8);
ALTER TABLE "staff_id_cards" ADD COLUMN "back_notes" TEXT;
