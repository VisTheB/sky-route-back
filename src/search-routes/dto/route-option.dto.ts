import { ApiProperty } from '@nestjs/swagger';

export class AirportRefDto {
  @ApiProperty({ example: 'SVO' })
  code!: string;

  @ApiProperty({ example: 'Moscow' })
  city!: string;
}

export class RouteSegmentDto {
  @ApiProperty({ example: 12345 })
  flight_id!: number;

  @ApiProperty({ example: 'PG0203' })
  route_no!: string;

  @ApiProperty({ type: AirportRefDto })
  departure_airport!: AirportRefDto;

  @ApiProperty({ type: AirportRefDto })
  arrival_airport!: AirportRefDto;

  @ApiProperty({ example: '2025-08-15T08:00:00+03:00' })
  scheduled_departure!: string;

  @ApiProperty({ example: '2025-08-15T09:30:00+03:00' })
  scheduled_arrival!: string;

  @ApiProperty({ example: 90, description: 'Длительность сегмента, минуты' })
  duration_minutes!: number;

  @ApiProperty({ enum: ['Economy', 'Comfort', 'Business'] })
  fare_conditions!: string;

  @ApiProperty({ example: 4500.0 })
  price!: number;
}

export class RouteOptionDto {
  @ApiProperty({ example: 0, description: 'Количество пересадок' })
  connections!: number;

  @ApiProperty({ example: 90, description: 'Полная длительность пути, минуты' })
  total_duration_minutes!: number;

  @ApiProperty({ example: 4500.0 })
  total_price!: number;

  @ApiProperty({ example: '2025-08-15T08:00:00+03:00' })
  departure_time!: string;

  @ApiProperty({ example: '2025-08-15T09:30:00+03:00' })
  arrival_time!: string;

  @ApiProperty({ type: [RouteSegmentDto] })
  segments!: RouteSegmentDto[];
}
