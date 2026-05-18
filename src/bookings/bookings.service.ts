import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Kysely, sql, Transaction } from 'kysely';
import { KYSELY } from '../db/db.module';
import type { DB } from '../db/schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingDto, FlightRow, TicketDto } from './dto/booking.dto';
import { BookingSummaryDto } from './dto/list-bookings.dto';
import { stableHash } from 'src/common/utils/create-hash';

type Executor = Kysely<DB> | Transaction<DB>;

@Injectable()
export class BookingsService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async create(
    dto: CreateBookingDto,
    idempotencyKey: string,
    createdByUid: string,
  ): Promise<BookingDto> {
    const requestHash = stableHash(dto);

    return this.db.transaction().execute(async (trx) => {
      const inserted = await sql<{ key: string }>`
        INSERT INTO idempotency_keys (key, request_hash)
        VALUES (${idempotencyKey}, ${requestHash})
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `.execute(trx);

      if (inserted.rows.length === 0) {
        const existing = await sql<{
          request_hash: string;
          response: BookingDto | null;
        }>`
          SELECT request_hash, response
          FROM idempotency_keys
          WHERE key = ${idempotencyKey}
        `.execute(trx);

        const row = existing.rows[0];
        if (row.request_hash !== requestHash) {
          throw new ConflictException(
            'Idempotency-Key was reused with a different request body',
          );
        }
        if (row.response === null) {
          throw new ConflictException(
            'Concurrent request with same Idempotency-Key is in progress',
          );
        }
        return row.response;
      }

      // Подтянуть и провалидировать все рейсы одним запросом
      const flights = await this.fetchAndValidateFlights(
        dto.flight_ids,
        dto.fare_conditions,
        trx,
      );

      // Проверить, что сегменты стыкуются (только для маршрутов > 1 сегмента)
      if (flights.length > 1) {
        this.assertConnectionsValid(flights);
      }

      const ticketPrice = flights.reduce((sum, f) => sum + Number(f.price!), 0);
      const totalAmount = ticketPrice * dto.passengers.length;

      // Бронирование
      const bookingResult = await sql<{ book_ref: string; book_date: Date }>`
        INSERT INTO bookings (book_ref, book_date, total_amount, created_by_uid)
        VALUES (
          upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6)),
          bookings.now(),
          ${totalAmount},
          ${createdByUid}
        )
        RETURNING book_ref, book_date
      `.execute(trx);

      const { book_ref, book_date } = bookingResult.rows[0];

      // Билеты + сегменты для каждого пассажира
      const ticketsResult: BookingDto['tickets'] = [];

      for (const passenger of dto.passengers) {
        // Билет
        const ticketRes = await sql<{ ticket_no: string }>`
          INSERT INTO tickets (ticket_no, book_ref, passenger_id, passenger_name, outbound)
          VALUES (
            lpad((floor(random() * 1e13)::bigint)::text, 13, '0'),
            ${book_ref},
            ${passenger.passenger_id},
            ${passenger.passenger_name},
            true
          )
          RETURNING ticket_no
        `
          .execute(trx)
          .catch((err: unknown) => {
            const pgErr = err as { code?: string; constraint?: string };
            if (
              pgErr.code === '23505' &&
              typeof pgErr.constraint === 'string' &&
              pgErr.constraint.includes('passenger_id')
            ) {
              throw new ConflictException(
                `Passenger ${passenger.passenger_id} is already in this booking`,
              );
            }
            throw err;
          });

        const ticket_no = ticketRes.rows[0].ticket_no;

        // Сегменты для этого билета
        const flightIds = flights.map((f) => f.flight_id);
        const prices = flights.map((f) => Number(f.price));
        await sql`
          INSERT INTO segments (ticket_no, flight_id, fare_conditions, price)
          SELECT ${ticket_no}, t.flight_id, ${dto.fare_conditions}, t.price
          FROM unnest(${flightIds}::int[], ${prices}::numeric[]) AS t(flight_id, price)
        `.execute(trx);

        ticketsResult.push({
          ticket_no,
          passenger_id: passenger.passenger_id,
          passenger_name: passenger.passenger_name,
          segments: flights.map((f) => ({
            flight_id: f.flight_id,
            flight_no: f.route_no,
            departure_airport: f.departure_airport,
            arrival_airport: f.arrival_airport,
            scheduled_departure: f.scheduled_departure.toISOString(),
            scheduled_arrival: f.scheduled_arrival.toISOString(),
            fare_conditions: dto.fare_conditions,
            price: Number(f.price),
            has_b_pass: false,
          })),
        });
      }

      const response: BookingDto = {
        book_ref,
        book_date: book_date.toISOString(),
        total_amount: totalAmount,
        tickets: ticketsResult,
      };

      await sql`
        UPDATE idempotency_keys
        SET response = ${JSON.stringify(response)}::jsonb
        WHERE key = ${idempotencyKey}
      `.execute(trx);

      return response;
    });
  }

  async getByRef(bookRef: string): Promise<BookingDto> {
    const ref = bookRef.toUpperCase();

    type Row = {
      book_ref: string;
      book_date: Date;
      total_amount: string;
      ticket_no: string | null;
      passenger_id: string | null;
      passenger_name: string | null;
      flight_id: number | null;
      route_no: string | null;
      departure_airport: string | null;
      arrival_airport: string | null;
      scheduled_departure: Date | null;
      scheduled_arrival: Date | null;
      fare_conditions: string | null;
      price: string | null;
      has_b_pass: boolean;
    };

    const result = await sql<Row>`
      SELECT
        b.book_ref,
        b.book_date,
        b.total_amount,
        t.ticket_no,
        t.passenger_id,
        t.passenger_name,
        s.flight_id,
        f.route_no,
        r.departure_airport,
        r.arrival_airport,
        f.scheduled_departure,
        f.scheduled_arrival,
        s.fare_conditions,
        s.price,
        (bp.ticket_no IS NOT NULL) AS has_b_pass
      FROM bookings b
      LEFT JOIN tickets  t ON t.book_ref = b.book_ref
      LEFT JOIN segments s ON s.ticket_no = t.ticket_no
      LEFT JOIN flights  f ON f.flight_id = s.flight_id
      LEFT JOIN routes   r ON r.route_no = f.route_no
                          AND r.validity @> f.scheduled_departure
      LEFT JOIN boarding_passes bp
            ON bp.ticket_no = s.ticket_no
           AND bp.flight_id = s.flight_id
      WHERE b.book_ref = ${ref}
      ORDER BY t.ticket_no, f.scheduled_departure
    `.execute(this.db);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Booking '${ref}' not found`);
    }

    const head = result.rows[0];
    const ticketsByNo = new Map<string, TicketDto>();

    for (const row of result.rows) {
      if (!row.ticket_no) continue;

      let ticket = ticketsByNo.get(row.ticket_no);
      if (!ticket) {
        ticket = {
          ticket_no: row.ticket_no,
          passenger_id: row.passenger_id!,
          passenger_name: row.passenger_name!,
          segments: [],
        };
        ticketsByNo.set(row.ticket_no, ticket);
      }

      if (row.flight_id !== null) {
        ticket.segments.push({
          flight_id: row.flight_id,
          flight_no: row.route_no!,
          departure_airport: row.departure_airport!,
          arrival_airport: row.arrival_airport!,
          scheduled_departure: row.scheduled_departure!.toISOString(),
          scheduled_arrival: row.scheduled_arrival!.toISOString(),
          fare_conditions: row.fare_conditions!,
          price: Number(row.price),
          has_b_pass: row.has_b_pass,
        });
      }
    }

    return {
      book_ref: head.book_ref,
      book_date: head.book_date.toISOString(),
      total_amount: Number(head.total_amount),
      tickets: Array.from(ticketsByNo.values()),
    };
  }

  async listByOwner(uid: string): Promise<BookingSummaryDto[]> {
    type Row = {
      book_ref: string;
      book_date: Date;
      total_amount: string;
      departure_airport: string;
      departure_city: string;
      arrival_airport: string;
      arrival_city: string;
      fare_conditions: string;
      passengers_count: number;
    };

    const result = await sql<Row>`
      WITH user_segments AS (
        SELECT
          b.book_ref,
          seg.fare_conditions,
          r.departure_airport,
          a_dep.city AS departure_city,
          r.arrival_airport,
          a_arr.city AS arrival_city,
          ROW_NUMBER() OVER (
            PARTITION BY b.book_ref ORDER BY f.scheduled_departure ASC
          ) AS rn_first,
          ROW_NUMBER() OVER (
            PARTITION BY b.book_ref ORDER BY f.scheduled_departure DESC
          ) AS rn_last
        FROM bookings b
        JOIN tickets t ON t.book_ref = b.book_ref
        JOIN segments seg ON seg.ticket_no = t.ticket_no
        JOIN flights f ON f.flight_id = seg.flight_id
        JOIN routes r ON r.route_no = f.route_no
                         AND r.validity @> f.scheduled_departure
        JOIN airports a_dep ON a_dep.airport_code = r.departure_airport
        JOIN airports a_arr ON a_arr.airport_code = r.arrival_airport
        WHERE b.created_by_uid = ${uid}
      )
      SELECT
        b.book_ref,
        b.book_date,
        b.total_amount,
        fs.departure_airport,
        fs.departure_city,
        ls.arrival_airport,
        ls.arrival_city,
        fs.fare_conditions,
        (SELECT COUNT(*)::int FROM tickets WHERE book_ref = b.book_ref)
          AS passengers_count
      FROM bookings b
      JOIN user_segments fs
           ON fs.book_ref = b.book_ref AND fs.rn_first = 1
      JOIN user_segments ls
           ON ls.book_ref = b.book_ref AND ls.rn_last = 1
      ORDER BY b.book_date DESC
    `.execute(this.db);

    return result.rows.map((row) => ({
      book_ref: row.book_ref,
      book_date: row.book_date.toISOString(),
      total_amount: Number(row.total_amount),
      departure_airport: row.departure_airport,
      departure_city: row.departure_city,
      arrival_airport: row.arrival_airport,
      arrival_city: row.arrival_city,
      fare_conditions: row.fare_conditions,
      passengers_count: row.passengers_count,
    }));
  }

  private async fetchAndValidateFlights(
    flightIds: number[],
    fareConditions: string,
    executor: Executor,
  ): Promise<FlightRow[]> {
    const result = await sql<FlightRow>`
      SELECT
        f.flight_id,
        f.route_no,
        r.departure_airport,
        r.arrival_airport,
        r.airplane_code,
        f.status::text AS status,
        f.scheduled_departure,
        f.scheduled_arrival,
        pr.price,
        EXISTS(
          SELECT 1 FROM seats s
          WHERE s.airplane_code = r.airplane_code
            AND s.fare_conditions = ${fareConditions}
        ) AS has_fare_class
      FROM flights f
      JOIN routes r
           ON r.route_no = f.route_no
          AND r.validity @> f.scheduled_departure
      LEFT JOIN pricing_rules pr
           ON pr.route_no = f.route_no
          AND pr.fare_conditions = ${fareConditions}
      WHERE f.flight_id = ANY(${flightIds}::int[])
    `.execute(executor);

    // Все ли найдены
    const foundIds = new Set(result.rows.map((r) => r.flight_id));
    const missing = flightIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Flights not found: ${missing.join(', ')}`);
    }

    // Все ли бронируемые по статусу
    const notBookable = result.rows.filter(
      (r) => !['Scheduled', 'On Time', 'Delayed'].includes(r.status),
    );
    if (notBookable.length > 0) {
      throw new UnprocessableEntityException(
        `Flights not bookable: ${notBookable.map((f) => f.flight_id).join(', ')}`,
      );
    }

    // Класс есть в самолёте для каждого рейса
    const wrongClass = result.rows.filter((r) => !r.has_fare_class);
    if (wrongClass.length > 0) {
      throw new UnprocessableEntityException(
        `Fare class ${fareConditions} unavailable on flights: ${wrongClass.map((f) => f.flight_id).join(', ')}`,
      );
    }

    // Цена есть в pricing_rules
    const noPrice = result.rows.filter((r) => r.price === null);
    if (noPrice.length > 0) {
      throw new UnprocessableEntityException(
        `No price for flights: ${noPrice.map((f) => f.flight_id).join(', ')}`,
      );
    }

    const byId = new Map(result.rows.map((r) => [r.flight_id, r]));
    return flightIds.map((id) => byId.get(id)!);
  }

  private assertConnectionsValid(flights: FlightRow[]): void {
    for (let i = 0; i < flights.length - 1; i++) {
      const cur = flights[i];
      const next = flights[i + 1];

      if (cur.arrival_airport !== next.departure_airport) {
        throw new UnprocessableEntityException(
          `Segments don't connect: ${cur.flight_id}, ${next.flight_id}`,
        );
      }

      const layoverMs =
        next.scheduled_departure.getTime() - cur.scheduled_arrival.getTime();
      const minLayover = 30 * 60 * 1000;

      if (layoverMs < minLayover) {
        throw new UnprocessableEntityException(
          `Too short layover between ${cur.flight_id} and ${next.flight_id}`,
        );
      }
    }
  }
}
