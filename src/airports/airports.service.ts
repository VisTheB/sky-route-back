import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import type { DB } from '../db/schema';
import { KYSELY } from '../db/db.module';
import { CountryAirportsDto } from './dto/country-airports.dto';
import {
  AirportDetailsDto,
  AirportDetailsRow,
} from './dto/airport-details.dto';

@Injectable()
export class AirportsService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async listCountriesWithAirports(): Promise<CountryAirportsDto[]> {
    const result = await sql<CountryAirportsDto>`
      WITH airport_roles AS (
        SELECT 
            a.country,
            a.city,
            a.airport_code,
            a.airport_name,
            bool_or(r.departure_airport = a.airport_code) AS is_departure,
            bool_or(r.arrival_airport   = a.airport_code) AS is_arrival
        FROM airports a
        JOIN routes r
             ON (r.departure_airport = a.airport_code 
              OR r.arrival_airport   = a.airport_code)
            AND r.validity @> bookings.now()
        GROUP BY a.country, a.city, a.airport_code, a.airport_name
      ),
      cities_grouped AS (
        SELECT 
            country,
            city,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'airport_code', airport_code,
                        'airport_name', airport_name
                    ) ORDER BY airport_code
                ) FILTER (WHERE is_departure),
                '[]'::jsonb
            ) AS departure_airports,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'airport_code', airport_code,
                        'airport_name', airport_name
                    ) ORDER BY airport_code
                ) FILTER (WHERE is_arrival),
                '[]'::jsonb
            ) AS arrival_airports
        FROM airport_roles
        GROUP BY country, city
      )
      SELECT 
          country,
          jsonb_agg(
              jsonb_build_object(
                  'city', city,
                  'departure_airports', departure_airports,
                  'arrival_airports', arrival_airports
              ) ORDER BY city
          ) AS cities
      FROM cities_grouped
      GROUP BY country
      ORDER BY country
    `.execute(this.db);

    return result.rows;
  }

  async getAirportByCode(code: string): Promise<AirportDetailsDto> {
    const result = await sql<AirportDetailsRow>`
    SELECT
        airport_code,
        airport_name,
        city,
        country,
        coordinates[0] AS longitude,
        coordinates[1] AS latitude,
        timezone AS timezone_name,
        EXTRACT(HOUR FROM
          (bookings.now() AT TIME ZONE timezone)
          - (bookings.now() AT TIME ZONE 'UTC')
        )::int AS tz_hours,
        EXTRACT(MINUTE FROM
          (bookings.now() AT TIME ZONE timezone)
          - (bookings.now() AT TIME ZONE 'UTC')
        )::int AS tz_minutes
    FROM airports
    WHERE airport_code = ${code}
  `.execute(this.db);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Airport '${code}' not found`);
    }

    const row = result.rows[0];

    return {
      airport_code: row.airport_code,
      airport_name: row.airport_name,
      country: row.country,
      city: row.city,
      coordinates: {
        longitude: row.longitude,
        latitude: row.latitude,
      },
      timezone: {
        name: row.timezone_name,
        offset: this.formatUtcOffset(row.tz_hours, row.tz_minutes),
      },
    };
  }

  private formatUtcOffset(hours: number, minutes: number): string {
    const sign = hours >= 0 ? '+' : '-';
    const absHours = Math.abs(hours);
    const absMinutes = Math.abs(minutes);

    return absMinutes === 0
      ? `UTC${sign}${absHours}`
      : `UTC${sign}${absHours}:${String(absMinutes).padStart(2, '0')}`;
  }
}
