import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CheckInRequestDto {
  @ApiProperty({
    example: '0005432123456',
    description: '13-значный номер билета',
  })
  @IsString()
  @Matches(/^\d{13}$/, { message: 'ticket_no must be 13 digits' })
  ticket_no!: string;

  @ApiProperty({ example: 12345 })
  @IsInt()
  @Min(1)
  flight_id!: number;

  @ApiPropertyOptional({
    example: '12A',
    description:
      'Желаемое место (формат: 1-3 цифры + буква, например 12A). ' +
      'Если не указано, назначается автоматически.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}[A-Za-z]$/, { message: 'seat_no must be like 12A' })
  seat_no?: string;
}

export class BoardingPassDto {
  @ApiProperty({ example: '0005432123456' })
  ticket_no!: string;

  @ApiProperty({ example: 12345 })
  flight_id!: number;

  @ApiProperty({ example: '12A' })
  seat_no!: string;

  @ApiProperty({ enum: ['Economy', 'Comfort', 'Business'] })
  fare_conditions!: string;
}

export class AvailableSeatsQueryDto {
  @ApiProperty({ example: 12345, description: 'Идентификатор рейса' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  flight_id!: number;
}

export class BoardingPassQueryDto {
  @ApiProperty({
    example: '0005432123456',
    description: '13-значный номер билета',
  })
  @IsString()
  @Matches(/^\d{13}$/, { message: 'ticket_no must be 13 digits' })
  ticket_no!: string;

  @ApiProperty({ example: 12345, description: 'Идентификатор рейса' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  flight_id!: number;
}

export class AvailableSeatDto {
  @ApiProperty({ example: '12A' })
  seat_no!: string;

  @ApiProperty({ enum: ['Economy', 'Comfort', 'Business'] })
  fare_conditions!: string;

  @ApiProperty({
    example: true,
    description: 'true - место свободно, false - уже занято',
  })
  available!: boolean;
}

export type SegmentInfo = {
  ticket_no: string;
  flight_id: number;
  fare_conditions: string;
  status: string;
  scheduled_departure: Date;
  airplane_code: string;
  now: Date;
  hours_until_departure: number;
};
