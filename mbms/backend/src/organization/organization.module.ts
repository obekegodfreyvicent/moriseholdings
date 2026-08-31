import { Module } from '@nestjs/common';
import { CompaniesController } from './companies/companies.controller';
import { CompaniesService } from './companies/companies.service';
import { BranchesController, CompanyBranchesController } from './branches/branches.controller';
import { BranchesService } from './branches/branches.service';
import { DepartmentsController, CompanyDepartmentsController } from './departments/departments.controller';
import { DepartmentsService } from './departments/departments.service';
import { CompanyPoliciesController, PoliciesController } from './policies/policies.controller';
import { PoliciesService } from './policies/policies.service';
import { InterCompanyTransactionsController } from './inter-company-transactions/inter-company-transactions.controller';
import { InterCompanyTransactionsService } from './inter-company-transactions/inter-company-transactions.service';

@Module({
  controllers: [
    CompaniesController,
    CompanyBranchesController,
    BranchesController,
    CompanyDepartmentsController,
    DepartmentsController,
    CompanyPoliciesController,
    PoliciesController,
    InterCompanyTransactionsController,
  ],
  providers: [CompaniesService, BranchesService, DepartmentsService, PoliciesService, InterCompanyTransactionsService],
})
export class OrganizationModule {}
