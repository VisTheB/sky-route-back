import { ApiProperty } from '@nestjs/swagger';

export class CoordinatesDto {
  @ApiProperty({ example: 37.4146 })
  longitude!: number;

  @ApiProperty({ example: 55.9726 })
  latitude!: number;
}

export class TimezoneDto {
  @ApiProperty({ example: 'Europe/Moscow', description: 'IANA-имя таймзоны' })
  name!: string;

  @ApiProperty({ example: 'UTC+3', description: 'Текущее смещение от UTC' })
  offset!: string;
}

export class AirportDetailsDto {
  @ApiProperty({ example: 'SVO' })
  airport_code!: string;

  @ApiProperty({ example: 'Sheremetyevo' })
  airport_name!: string;

  @ApiProperty({ example: 'Russia' })
  country!: string;

  @ApiProperty({ example: 'Moscow' })
  city!: string;

  @ApiProperty({ type: CoordinatesDto })
  coordinates!: CoordinatesDto;

  @ApiProperty({ type: TimezoneDto })
  timezone!: TimezoneDto;
}

export type AirportDetailsRow = {
  airport_code: string;
  airport_name: string;
  city: string;
  country: string;
  longitude: number;
  latitude: number;
  timezone_name: string;
  tz_hours: number;
  tz_minutes: number;
};
