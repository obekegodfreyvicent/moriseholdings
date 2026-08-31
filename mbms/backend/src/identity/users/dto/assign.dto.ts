import { IsOptional, IsUUID } from 'class-validator';

export class AssignScopeDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  // FR-USER-04: scope may additionally be narrowed to one department within
  // the branch/company; null/omitted means the scope isn't department-limited.
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class AssignRoleDto {
  @IsUUID()
  roleId: string;
}

// FR-USER-06: direct permission grant to a user, independent of their roles.
export class AssignPermissionDto {
  @IsUUID()
  permissionId: string;
}

export class ResetPasswordDto {
  // Administrator-initiated reset: generates a temporary password server-side
  // rather than accepting an admin-supplied one, so nobody but the affected
  // user ever knows their own current password.
}
