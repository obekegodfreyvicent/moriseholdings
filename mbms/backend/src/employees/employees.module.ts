import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { StaffIdCardsModule } from '../staff-id-cards/staff-id-cards.module';

@Module({
  imports: [StaffIdCardsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
