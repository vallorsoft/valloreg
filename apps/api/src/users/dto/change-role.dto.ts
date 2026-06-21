import { IsEnum } from 'class-validator';
import { TenantRole } from '@valloreg/shared';

export class ChangeRoleDto {
  @IsEnum(TenantRole, { message: 'Érvénytelen szerepkör.' })
  role!: TenantRole;
}
