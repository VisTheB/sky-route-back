import { ApiProperty } from '@nestjs/swagger';

export class BookingSummaryDto {
  @ApiProperty({ example: 'ABC123' })
  book_ref!: string;

  @ApiProperty({ example: '2026-05-04T12:00:00+00:00' })
  book_date!: string;

  @ApiProperty({ example: 25000.0, description: 'Сумма по всем билетам' })
  total_amount!: number;

  @ApiProperty({
    example: 'SVO',
    description: 'Аэропорт вылета первого сегмента',
  })
  departure_airport!: string;

  @ApiProperty({
    example: 'Москва',
    description: 'Город вылета первого сегмента',
  })
  departure_city!: string;

  @ApiProperty({
    example: 'AER',
    description: 'Аэропорт прилёта последнего сегмента',
  })
  arrival_airport!: string;

  @ApiProperty({
    example: 'Сочи',
    description: 'Город прилёта последнего сегмента',
  })
  arrival_city!: string;

  @ApiProperty({ enum: ['Economy', 'Comfort', 'Business'] })
  fare_conditions!: string;

  @ApiProperty({
    example: 2,
    description: 'Количество пассажиров в бронировании',
  })
  passengers_count!: number;
}
