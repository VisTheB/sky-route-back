import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PassengerDto {
  @ApiProperty({ example: '1234 567890', description: 'Номер документа' })
  @IsString()
  @MinLength(3)
  passenger_id!: string;

  @ApiProperty({ example: 'IVAN PETROV', description: 'Полное имя пассажира' })
  @IsString()
  @MinLength(3)
  passenger_name!: string;
}

export class CreateBookingDto {
  @ApiProperty({
    example: [12345, 12999],
    description: 'Идентификаторы рейсов в порядке следования',
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  flight_ids!: number[];

  @ApiProperty({ enum: ['Economy', 'Comfort', 'Business'], example: 'Economy' })
  @IsEnum(['Economy', 'Comfort', 'Business'])
  fare_conditions!: 'Economy' | 'Comfort' | 'Business';

  @ApiProperty({ type: [PassengerDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers!: PassengerDto[];
}
