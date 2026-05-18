import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsDateString, Min, Max } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset: number = 0;

  @ApiPropertyOptional({
    description: 'Начало диапазона (включительно), формат YYYY-MM-DD',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Конец диапазона (исключительно), формат YYYY-MM-DD',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class InboundFlightEntryDto {
  @ApiProperty({ example: 'PG0203', description: 'Номер маршрута' })
  route_no!: string;

  @ApiProperty({ example: 'SVO' })
  origin_code!: string;

  @ApiProperty({ example: 'Moscow' })
  origin_city!: string;

  @ApiProperty({
    example: '2025-08-15T15:40:00',
    description: 'Время прибытия по местному времени аэропорта прибытия',
  })
  arrival_local!: string;

  @ApiProperty({
    example: 'On Time',
    enum: [
      'Scheduled',
      'On Time',
      'Delayed',
      'Departed',
      'Arrived',
      'Cancelled',
    ],
  })
  status!: string;
}

export class PaginatedInboundFlightsDto {
  @ApiProperty({ type: [InboundFlightEntryDto] })
  items!: InboundFlightEntryDto[];

  @ApiProperty({ example: 1234, description: 'Всего рейсов' })
  total!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}
