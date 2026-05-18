import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY } from '../db/db.module';
import type { DB } from '../db/schema';
import {
  MaxConnectionsParam,
  SearchRoutesQueryDto,
  PathRow,
  SegmentDetailsRow,
} from './dto/search-routes.dto';
import { RouteOptionDto, RouteSegmentDto } from './dto/route-option.dto';

const MIN_LAYOVER = '30 minutes';
const MAX_LAYOVER = '12 hours';
const CONNECTIONS_LIMIT = 3;
const RESULTS_LIMIT = 60;

@Injectable()
export class SearchRoutesService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async search(query: SearchRoutesQueryDto): Promise<RouteOptionDto[]> {
    const [fromAirports, toAirports] = await Promise.all([
      this.resolvePoint(query.from),
      this.resolvePoint(query.to),
    ]);

    if (fromAirports.length === 0) {
      throw new NotFoundException(`Origin point '${query.from}' not found`);
    }
    if (toAirports.length === 0) {
      throw new NotFoundException(`Destination point '${query.to}' not found`);
    }

    const toSet = new Set(toAirports);
    const sameSets =
      fromAirports.length === toSet.size &&
      fromAirports.every((a) => toSet.has(a));
    if (sameSets) {
      throw new UnprocessableEntityException(
        'Origin and destination resolve to the same set of airports',
      );
    }

    const maxConnections = this.resolveMaxConnections(query.max_connections);
    const paths = await this.findPaths(
      fromAirports,
      toAirports,
      query.date,
      query.class,
      maxConnections,
    );
    if (paths.length === 0) {
      return [];
    }
    const allFlightIds = Array.from(
      new Set(paths.flatMap((p) => p.flight_ids)),
    );
    const segmentDetails = await this.fetchSegmentDetails(
      allFlightIds,
      query.class,
    );

    return paths.map((p) =>
      this.buildRouteOption(p, segmentDetails, query.class),
    );
  }

  private async resolvePoint(point: string): Promise<string[]> {
    const result = await sql<{ airport_code: string }>`
      SELECT airport_code 
      FROM airports
      WHERE airport_code = UPPER(${point})
         OR LOWER(city) = LOWER(${point})
    `.execute(this.db);

    return result.rows.map((r) => r.airport_code);
  }

  private resolveMaxConnections(param: MaxConnectionsParam): number {
    if (param === 'unbound') return CONNECTIONS_LIMIT;
    return Number(param);
  }

  private async findPaths(
    fromAirports: string[],
    toAirports: string[],
    date: string,
    fareConditions: string,
    maxConnections: number,
  ): Promise<PathRow[]> {
    const result = await sql<PathRow>`
      WITH RECURSIVE
      day_flights AS (
        SELECT
          t.flight_id,
          t.departure_airport,
          t.arrival_airport,
          a_dep.city AS dep_city,
          a_arr.city AS arr_city,
          a_dep.timezone AS dep_timezone,
          t.scheduled_departure,
          t.scheduled_arrival,
          pr.price
        FROM timetable t
        JOIN pricing_rules pr
             ON pr.route_no = t.route_no
            AND pr.fare_conditions = ${fareConditions}
        JOIN airports a_dep ON a_dep.airport_code = t.departure_airport
        JOIN airports a_arr ON a_arr.airport_code = t.arrival_airport
        WHERE t.status IN ('Scheduled', 'On Time', 'Delayed')
          AND EXISTS (
            SELECT 1 FROM seats s
            WHERE s.airplane_code = t.airplane_code
              AND s.fare_conditions = ${fareConditions}
              AND NOT EXISTS (
                SELECT 1 FROM boarding_passes bp
                WHERE bp.flight_id = t.flight_id
                  AND bp.seat_no = s.seat_no
              )
          )
      ),
      paths AS (
        SELECT
          -- первый сегмент из одного из from_airports, в указанную дату по местному времени
          ARRAY[df.flight_id] AS flight_ids,
          df.departure_airport AS origin,
          df.arrival_airport AS current_airport,
          ARRAY[df.dep_city, df.arr_city] AS visited_cities,
          df.scheduled_departure AS first_departure,
          df.scheduled_arrival AS last_arrival,
          df.price AS total_price,
          0 AS connections
        FROM day_flights df
        WHERE df.departure_airport = ANY(${fromAirports}::char(3)[])
          AND (df.scheduled_departure AT TIME ZONE df.dep_timezone)::date = ${date}::date

        UNION ALL

        -- рекурсия: следующий сегмент стыкуется по аэропорту и времени
        SELECT
          p.flight_ids || df.flight_id,
          p.origin,
          df.arrival_airport,
          p.visited_cities || df.arr_city,
          p.first_departure,
          df.scheduled_arrival,
          p.total_price + df.price,
          p.connections + 1
        FROM paths p
        JOIN day_flights df
             ON df.departure_airport = p.current_airport
            AND df.scheduled_departure >= p.last_arrival + (${MIN_LAYOVER})::interval
            AND df.scheduled_departure <= p.last_arrival + (${MAX_LAYOVER})::interval
            AND df.arr_city <> ALL(p.visited_cities)
        WHERE p.connections < ${maxConnections}
      )
      SELECT
        flight_ids,
        connections,
        total_price,
        first_departure,
        last_arrival
      FROM paths
      WHERE current_airport = ANY(${toAirports}::char(3)[])
      ORDER BY total_price, (last_arrival - first_departure), flight_ids[1]
      LIMIT ${RESULTS_LIMIT}
    `.execute(this.db);

    return result.rows;
  }

  private async fetchSegmentDetails(
    flightIds: number[],
    fareConditions: string,
  ): Promise<Map<number, SegmentDetailsRow>> {
    const result = await sql<SegmentDetailsRow>`
      SELECT
        t.flight_id,
        t.route_no,
        t.departure_airport AS dep_code,
        COALESCE(a_dep.city, t.departure_airport) AS dep_city,
        t.arrival_airport AS arr_code,
        COALESCE(a_arr.city, t.arrival_airport) AS arr_city,
        t.scheduled_departure,
        t.scheduled_arrival,
        TO_CHAR(t.scheduled_departure_local, 'YYYY-MM-DD"T"HH24:MI:SS')
          AS scheduled_departure_local,
        TO_CHAR(t.scheduled_arrival_local, 'YYYY-MM-DD"T"HH24:MI:SS')
          AS scheduled_arrival_local,
        pr.price
      FROM timetable t
      JOIN airports a_dep ON a_dep.airport_code = t.departure_airport
      JOIN airports a_arr ON a_arr.airport_code = t.arrival_airport
      JOIN pricing_rules pr
           ON pr.route_no = t.route_no
          AND pr.fare_conditions = ${fareConditions}
      WHERE t.flight_id = ANY(${flightIds}::int[])
    `.execute(this.db);

    return new Map(result.rows.map((r) => [r.flight_id, r]));
  }

  private buildRouteOption(
    path: PathRow,
    segmentDetails: Map<number, SegmentDetailsRow>,
    fareConditions: string,
  ): RouteOptionDto {
    const segments: RouteSegmentDto[] = path.flight_ids.map((id) => {
      const d = segmentDetails.get(id)!;
      const durationMinutes = Math.round(
        (d.scheduled_arrival.getTime() - d.scheduled_departure.getTime()) /
          60000,
      );
      return {
        flight_id: d.flight_id,
        route_no: d.route_no,
        departure_airport: { code: d.dep_code, city: d.dep_city },
        arrival_airport: { code: d.arr_code, city: d.arr_city },
        scheduled_departure: d.scheduled_departure_local,
        scheduled_arrival: d.scheduled_arrival_local,
        duration_minutes: durationMinutes,
        fare_conditions: fareConditions,
        price: Number(d.price),
      };
    });

    const totalDurationMs =
      path.last_arrival.getTime() - path.first_departure.getTime();

    return {
      connections: path.connections,
      total_duration_minutes: Math.round(totalDurationMs / 60000),
      total_price: Number(path.total_price),
      departure_time: segments[0].scheduled_departure,
      arrival_time: segments[segments.length - 1].scheduled_arrival,
      segments,
    };
  }
}
