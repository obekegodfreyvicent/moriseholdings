-- Staff Identification Card — drop the blood group from the card back
-- (3 September 2026). An administrator asked for the "Blood group" section to
-- be removed; the rest of the back face (national id, emergency contact,
-- issuer address, conditions of use, barcode) is unchanged. back_notes is
-- kept.
ALTER TABLE "staff_id_cards" DROP COLUMN "blood_group";
