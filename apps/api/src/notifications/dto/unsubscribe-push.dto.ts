import { IsNotEmpty, IsString } from 'class-validator';

/** Leiratkozás egy konkrét push endpoint alapján. */
export class UnsubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;
}
