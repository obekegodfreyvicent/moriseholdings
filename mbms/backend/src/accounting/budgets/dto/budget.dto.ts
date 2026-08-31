import { IsNumber, IsUUID, Min } from 'class-validator';

export class SetBudgetDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  financialPeriodId: string;

  @IsUUID()
  accountId: string;

  @IsNumber()
  @Min(0)
  budgetedAmount: number;
}
