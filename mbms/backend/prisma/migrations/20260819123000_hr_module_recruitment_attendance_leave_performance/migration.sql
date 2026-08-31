-- CreateEnum
CREATE TYPE "VacancyStatus" AS ENUM ('draft', 'pending_approval', 'open', 'on_hold', 'closed');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('applied', 'shortlisted', 'interview_scheduled', 'interviewed', 'offered', 'hired', 'rejected');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('pending', 'accepted', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'late', 'absent', 'half_day');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('annual', 'sick', 'maternity', 'paternity', 'emergency');

-- CreateEnum
CREATE TYPE "LeaveApplicationStatus" AS ENUM ('submitted', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ReviewCycleStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('pending', 'achieved', 'not_achieved');

-- CreateEnum
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('self_assessment_pending', 'manager_review_pending', 'completed');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "document_reference" VARCHAR(150),
ADD COLUMN     "shift_id" TEXT,
ADD COLUMN     "user_id" TEXT;

-- CreateTable
CREATE TABLE "employee_employment_history" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "job_title" VARCHAR(150),
    "department_id" TEXT,
    "branch_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_employment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_vacancies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "department_id" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "employment_type" VARCHAR(50),
    "number_of_positions" INTEGER NOT NULL DEFAULT 1,
    "status" "VacancyStatus" NOT NULL DEFAULT 'draft',
    "posted_date" DATE,
    "closing_date" DATE,
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "vacancy_id" TEXT NOT NULL,
    "applicant_name" VARCHAR(200) NOT NULL,
    "applicant_email" VARCHAR(255) NOT NULL,
    "applicant_phone" VARCHAR(30),
    "cv_reference" VARCHAR(150),
    "cover_note" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'applied',
    "rejection_reason" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "interviewer_employee_id" TEXT,
    "mode" VARCHAR(50),
    "status" "InterviewStatus" NOT NULL DEFAULT 'scheduled',
    "score" SMALLINT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_offers" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "offered_salary" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "proposed_start_date" DATE NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'pending',
    "issued_by" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "onboarded_employee_id" TEXT,

    CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clock_in_time" TIMESTAMP(3),
    "clock_out_time" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'present',
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled_days" INTEGER NOT NULL,
    "used_days" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_applications" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_requested" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "LeaveApplicationStatus" NOT NULL DEFAULT 'submitted',
    "submitted_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_review_cycles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "ReviewCycleStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_review_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_objectives" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "weight" SMALLINT,
    "target_value" VARCHAR(100),
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "manager_employee_id" TEXT,
    "self_assessment" TEXT,
    "self_assessment_at" TIMESTAMP(3),
    "manager_assessment" TEXT,
    "manager_rating" SMALLINT,
    "promotion_recommended" BOOLEAN NOT NULL DEFAULT false,
    "training_recommendation" TEXT,
    "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'self_assessment_pending',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_employment_history_employee_id_idx" ON "employee_employment_history"("employee_id");

-- CreateIndex
CREATE INDEX "job_vacancies_company_id_idx" ON "job_vacancies"("company_id");

-- CreateIndex
CREATE INDEX "job_vacancies_status_idx" ON "job_vacancies"("status");

-- CreateIndex
CREATE INDEX "job_applications_vacancy_id_idx" ON "job_applications"("vacancy_id");

-- CreateIndex
CREATE INDEX "job_applications_status_idx" ON "job_applications"("status");

-- CreateIndex
CREATE INDEX "interviews_application_id_idx" ON "interviews"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_offers_application_id_key" ON "job_offers"("application_id");

-- CreateIndex
CREATE INDEX "shifts_company_id_idx" ON "shifts"("company_id");

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_idx" ON "attendance_records"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_records_company_id_idx" ON "attendance_records"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_date_key" ON "attendance_records"("employee_id", "date");

-- CreateIndex
CREATE INDEX "leave_balances_employee_id_idx" ON "leave_balances"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_year_key" ON "leave_balances"("employee_id", "leave_type", "year");

-- CreateIndex
CREATE INDEX "leave_applications_employee_id_idx" ON "leave_applications"("employee_id");

-- CreateIndex
CREATE INDEX "leave_applications_company_id_idx" ON "leave_applications"("company_id");

-- CreateIndex
CREATE INDEX "leave_applications_status_idx" ON "leave_applications"("status");

-- CreateIndex
CREATE INDEX "performance_review_cycles_company_id_idx" ON "performance_review_cycles"("company_id");

-- CreateIndex
CREATE INDEX "performance_objectives_cycle_id_idx" ON "performance_objectives"("cycle_id");

-- CreateIndex
CREATE INDEX "performance_objectives_employee_id_idx" ON "performance_objectives"("employee_id");

-- CreateIndex
CREATE INDEX "performance_reviews_employee_id_idx" ON "performance_reviews"("employee_id");

-- CreateIndex
CREATE INDEX "performance_reviews_company_id_idx" ON "performance_reviews"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_cycle_id_employee_id_key" ON "performance_reviews"("cycle_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- AddForeignKey
ALTER TABLE "employee_employment_history" ADD CONSTRAINT "employee_employment_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "job_vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_objectives" ADD CONSTRAINT "performance_objectives_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

