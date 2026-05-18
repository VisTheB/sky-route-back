import { ApiProperty } from '@nestjs/swagger';

export class OutboundFlightEntryDto {
  @ApiProperty({ example: 'PG0204', description: 'Номер маршрута' })
  route_no!: string;

  @ApiProperty({ example: 'LED' })
  destination_code!: string;

  @ApiProperty({ example: 'Saint Petersburg' })
  destination_city!: string;

  @ApiProperty({
    example: '2025-08-15T08:30:00',
    description: 'Время вылета по местному времени аэропорта вылета',
  })
  departure_local!: string;

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

export class PaginatedOutboundFlightsDto {
  @ApiProperty({ type: [OutboundFlightEntryDto] })
  items!: OutboundFlightEntryDto[];

  @ApiProperty({ example: 1234 })
  total!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}
