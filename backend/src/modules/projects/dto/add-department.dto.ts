import { IsString } from 'class-validator';

export class AddDepartmentDto {
  @IsString()
  departmentId: string;
}
