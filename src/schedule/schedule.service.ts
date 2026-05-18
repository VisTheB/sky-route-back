import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import type { DB } from '../db/schema';
import { KYSELY } from '../db/db.module';
import {
  PaginationQueryDto,
  PaginatedInboundFlightsDto,
} from './dto/inbound-schedule.dto';
import { PaginatedOutboundFlightsDto } from './dto/outbound-schedule.dto';

type Direction = 'inbound' | 'outbound';

type FlightRow = {
  route_no: string;
  peer_code: string;
  peer_city: string;
  time_local: string;
  status: string;
};

type FlightsPage = {
  rows: FlightRow[];
  total: number;
  limit: number;
  offset: number;
};

@Injectable()
export class ScheduleService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async listInboundFlights(
    airportCode: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedInboundFlightsDto> {
    const { rows, total, limit, offset } = await this.listFlights(
      airportCode,
      query,
      'inbound',
    );
    return {
      items: rows.map((row) => ({
        route_no: row.route_no,
        origin_code: row.peer_code,
        origin_city: row.peer_city,
        arrival_local: row.time_local,
        status: row.status,
      })),
      total,
      limit,
      offset,
    };
  }

  async listOutboundFlights(
    airportCode: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedOutboundFlightsDto> {
    const { rows, total, limit, offset } = await this.listFlights(
      airportCode,
      query,
      'outbound',
    );
    return {
      items: rows.map((row) => ({
        route_no: row.route_no,
        destination_code: row.peer_code,
        destination_city: row.peer_city,
        departure_local: row.time_local,
        status: row.status,
      })),
      total,
      limit,
      offset,
    };
  }

  private async listFlights(
    airportCode: string,
    query: PaginationQueryDto,
    direction: Direction,
  ): Promise<FlightsPage> {
    await this.assertAirportExists(airportCode);

    const { limit, offset, from, to } = query;
    const isInbound = direction === 'inbound';

    const filterCol = sql.ref(
      isInbound ? 't.arrival_airport' : 't.departure_airport',
    );
    const peerCol = sql.ref(
      isInbound ? 't.departure_airport' : 't.arrival_airport',
    );
    const timeCol = sql.ref(
      isInbound ? 't.scheduled_arrival_local' : 't.scheduled_departure_local',
    );

    const fromFilter = from ? sql`AND ${timeCol} >= ${from}::date` : sql``;
    const toFilter = to ? sql`AND ${timeCol} <  ${to}::date` : sql``;

    const totalRes = await sql<{ total: string }>`
      SELECT COUNT(*)::text AS total
      FROM timetable t
      WHERE ${filterCol} = ${airportCode}
        ${fromFilter}
        ${toFilter}
    `.execute(this.db);
    const total = Number(totalRes.rows[0].total);

    const result = await sql<FlightRow>`
      SELECT
          t.route_no,
          ${peerCol} AS peer_code,
          a.city AS peer_city,
          TO_CHAR(${timeCol}, 'YYYY-MM-DD"T"HH24:MI:SS') AS time_local,
          t.status
      FROM timetable t
      JOIN airports a
           ON a.airport_code = ${peerCol}
      WHERE ${filterCol} = ${airportCode}
        ${fromFilter}
        ${toFilter}
      ORDER BY ${timeCol} DESC, peer_city
      LIMIT ${limit} OFFSET ${offset}
    `.execute(this.db);

    return { rows: result.rows, total, limit, offset };
  }

  private async assertAirportExists(code: string): Promise<void> {
    const { rows } = await sql<{ exists: boolean }>`
      SELECT EXISTS(
        SELECT 1 FROM airports WHERE airport_code = ${code}
      ) AS exists
    `.execute(this.db);

    if (!rows[0]?.exists) {
      throw new NotFoundException(`Airport '${code}' not found`);
    }
  }
}
