import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  // Intentionally no MaxLength — sign-in must accept any previously stored
  // password, including ones created before the 12-character cap existed.
  @IsString()
  @IsNotEmpty()
  password: string;
}
