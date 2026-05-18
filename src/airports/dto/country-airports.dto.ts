import { ApiProperty } from '@nestjs/swagger';

export class AirportRefDto {
  @ApiProperty({ example: 'SVO' })
  airport_code!: string;

  @ApiProperty({ example: 'Шереметьево' })
  airport_name!: string;
}

export class CityAirportsDto {
  @ApiProperty({ example: 'Москва' })
  city!: string;

  @ApiProperty({
    type: [AirportRefDto],
    description: 'Аэропорты, из которых есть вылеты',
  })
  departure_airports!: AirportRefDto[];

  @ApiProperty({
    type: [AirportRefDto],
    description: 'Аэропорты, в которые есть прилёты',
  })
  arrival_airports!: AirportRefDto[];
}

export class CountryAirportsDto {
  @ApiProperty({ example: 'Россия' })
  country!: string;

  @ApiProperty({ type: [CityAirportsDto] })
  cities!: CityAirportsDto[];
}
