import { Module } from '@nestjs/common';
import { StaffIdCardsController } from './staff-id-cards.controller';
import { StaffIdCardsService } from './staff-id-cards.service';

// Automatic Staff Identification Card (3 September 2026). Exports its service
// so EmployeesModule can issue / sync a card automatically on employee
// create and status change.
@Module({
  controllers: [StaffIdCardsController],
  providers: [StaffIdCardsService],
  exports: [StaffIdCardsService],
})
export class StaffIdCardsModule {}
