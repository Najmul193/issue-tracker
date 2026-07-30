import { IsString, IsNotEmpty, IsOptional, IsEmail, MinLength, MaxLength } from 'class-validator';

/**
 * NOTE: the global ValidationPipe runs with `whitelist: true`, so any property
 * NOT declared here is silently stripped before it reaches UsersService.create().
 * Every field the service reads must be declared — `departmentId` in particular,
 * which the controller's previous inline body type omitted.
 */
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(12, { message: 'Password must be no more than 12 characters' })
  password: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsOptional()
  newOrganizationName?: string;

  @IsString()
  @IsOptional()
  newOrganizationType?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;
}
