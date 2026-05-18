import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum FareConditions {
  Economy = 'Economy',
  Comfort = 'Comfort',
  Business = 'Business',
}

export const MAX_CONNECTIONS_VALUES: string[] = ['0', '1', '2', '3', 'unbound'];
export type MaxConnectionsParam = '0' | '1' | '2' | '3' | 'unbound';

export class SearchRoutesQueryDto {
  @ApiProperty({
    example: 'Moscow',
    description: 'IATA-код аэропорта (3 буквы) или название города',
  })
  @IsString()
  @MinLength(1)
  from!: string;

  @ApiProperty({ example: 'LED', description: 'IATA-код или название города' })
  @IsString()
  @MinLength(1)
  to!: string;

  @ApiProperty({ example: '2025-08-15', description: 'Дата вылета YYYY-MM-DD' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: FareConditions, example: FareConditions.Economy })
  @IsEnum(FareConditions)
  class!: FareConditions;

  @ApiPropertyOptional({
    enum: MAX_CONNECTIONS_VALUES,
    default: 'unbound',
    description: 'Максимум пересадок. "unbound" интерпретируется как 3.',
  })
  @IsOptional()
  @IsIn(MAX_CONNECTIONS_VALUES)
  max_connections: MaxConnectionsParam = 'unbound';
}

export type PathRow = {
  flight_ids: number[];
  connections: number;
  total_price: string;
  first_departure: Date;
  last_arrival: Date;
};

export type SegmentDetailsRow = {
  flight_id: number;
  route_no: string;
  dep_code: string;
  dep_city: string;
  arr_code: string;
  arr_city: string;
  scheduled_departure: Date;
  scheduled_arrival: Date;
  scheduled_departure_local: string;
  scheduled_arrival_local: string;
  price: string;
};
