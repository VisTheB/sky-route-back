import { ApiProperty } from '@nestjs/swagger';

export class SegmentDto {
  @ApiProperty({ example: 12345 })
  flight_id!: number;

  @ApiProperty({ example: 'PG0203' })
  flight_no!: string;

  @ApiProperty({ example: 'SVO' })
  departure_airport!: string;

  @ApiProperty({ example: 'LED' })
  arrival_airport!: string;

  @ApiProperty({ example: '2026-05-10T08:00:00+03:00' })
  scheduled_departure!: string;

  @ApiProperty({ example: '2026-05-10T09:30:00+03:00' })
  scheduled_arrival!: string;

  @ApiProperty({ enum: ['Economy', 'Comfort', 'Business'] })
  fare_conditions!: string;

  @ApiProperty({ example: 4500.0 })
  price!: number;

  @ApiProperty({
    example: false,
    description:
      'true - у пассажира уже выдан посадочный талон на этот сегмент',
  })
  has_b_pass!: boolean;
}

export class TicketDto {
  @ApiProperty({ example: '0005432123456' })
  ticket_no!: string;

  @ApiProperty({ example: '1234 567890' })
  passenger_id!: string;

  @ApiProperty({ example: 'IVAN PETROV' })
  passenger_name!: string;

  @ApiProperty({ type: [SegmentDto] })
  segments!: SegmentDto[];
}

export class BookingDto {
  @ApiProperty({ example: 'ABC123' })
  book_ref!: string;

  @ApiProperty({ example: '2026-05-04T12:00:00+00:00' })
  book_date!: string;

  @ApiProperty({ example: 25000.0, description: 'Сумма по всем билетам' })
  total_amount!: number;

  @ApiProperty({ type: [TicketDto] })
  tickets!: TicketDto[];
}

export type FlightRow = {
  flight_id: number;
  route_no: string;
  departure_airport: string;
  arrival_airport: string;
  airplane_code: string;
  status: string;
  scheduled_departure: Date;
  scheduled_arrival: Date;
  price: string | null;
  has_fare_class: boolean;
};
