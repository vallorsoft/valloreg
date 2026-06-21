import { IsEmail, IsEnum } from 'class-validator';
import { TenantRole } from '@valloreg/shared';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsEnum(TenantRole, { message: 'Érvénytelen szerepkör.' })
  role!: TenantRole;
}
