import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY } from '../db/db.module';
import type { DB } from '../db/schema';
import {
  AvailableSeatDto,
  BoardingPassDto,
  CheckInRequestDto,
  SegmentInfo,
} from './dto/checkin.dto';

const AUTO_SEAT_MAX_RETRIES = 5;

@Injectable()
export class CheckinService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async checkIn(
    dto: CheckInRequestDto,
  ): Promise<{ result: BoardingPassDto; created: boolean }> {
    const segment = await this.fetchSegment(dto.ticket_no, dto.flight_id);
    this.assertCheckinWindow(segment);

    const requestedSeat = dto.seat_no?.trim().toUpperCase();

    if (requestedSeat) {
      return this.checkInWithSeat(dto.ticket_no, requestedSeat, segment);
    }
    return this.checkInAutoSeat(dto.ticket_no, segment);
  }

  private async checkInWithSeat(
    ticketNo: string,
    seatNo: string,
    segment: SegmentInfo,
  ): Promise<{ result: BoardingPassDto; created: boolean }> {
    await this.validateRequestedSeat(seatNo, segment);

    try {
      const inserted = await sql<{ seat_no: string }>`
        INSERT INTO boarding_passes (ticket_no, flight_id, seat_no)
        VALUES (${ticketNo}, ${segment.flight_id}, ${seatNo})
        ON CONFLICT (ticket_no, flight_id) DO NOTHING
        RETURNING seat_no
      `.execute(this.db);

      if (inserted.rows.length === 0) {
        // Уже зарегистрирован на этот сегмент, возвратить существующее место
        const existingSeat = await this.fetchExistingSeat(
          ticketNo,
          segment.flight_id,
        );
        if (existingSeat.toUpperCase() !== seatNo) {
          throw new ConflictException(
            `Already checked in to seat ${existingSeat}`,
          );
        }
        return {
          created: false,
          result: this.buildBoardingPass(ticketNo, segment, existingSeat),
        };
      }

      return {
        created: true,
        result: this.buildBoardingPass(
          ticketNo,
          segment,
          inserted.rows[0].seat_no,
        ),
      };
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string };
      if (
        pgErr.code === '23505' &&
        typeof pgErr.constraint === 'string' &&
        pgErr.constraint.includes('seat_no')
      ) {
        // Кто-то занял место между validate и insert
        throw new ConflictException(`Seat ${seatNo} is already taken`);
      }
      throw err;
    }
  }

  private async checkInAutoSeat(
    ticketNo: string,
    segment: SegmentInfo,
  ): Promise<{ result: BoardingPassDto; created: boolean }> {
    for (let attempt = 0; attempt < AUTO_SEAT_MAX_RETRIES; attempt++) {
      const seatNo = await this.pickFreeSeat(segment);

      try {
        const inserted = await sql<{ seat_no: string }>`
          INSERT INTO boarding_passes (ticket_no, flight_id, seat_no)
          VALUES (${ticketNo}, ${segment.flight_id}, ${seatNo})
          ON CONFLICT (ticket_no, flight_id) DO NOTHING
          RETURNING seat_no
        `.execute(this.db);

        if (inserted.rows.length === 0) {
          // Уже зарегистрирован на этот сегмент, возвратить существующее место
          const existingSeat = await this.fetchExistingSeat(
            ticketNo,
            segment.flight_id,
          );
          return {
            created: false,
            result: this.buildBoardingPass(ticketNo, segment, existingSeat),
          };
        }

        return {
          created: true,
          result: this.buildBoardingPass(
            ticketNo,
            segment,
            inserted.rows[0].seat_no,
          ),
        };
      } catch (err: unknown) {
        const pgErr = err as { code?: string; constraint?: string };
        if (
          pgErr.code === '23505' &&
          typeof pgErr.constraint === 'string' &&
          pgErr.constraint.includes('seat_no')
        ) {
          continue;
        }
        throw err;
      }
    }

    throw new UnprocessableEntityException(
      'Could not allocate a free seat, please retry',
    );
  }

  async getBoardingPass(
    ticketNo: string,
    flightId: number,
  ): Promise<BoardingPassDto> {
    const result = await sql<{ seat_no: string; fare_conditions: string }>`
      SELECT bp.seat_no, s.fare_conditions
      FROM boarding_passes bp
      JOIN segments s
           ON s.ticket_no = bp.ticket_no
          AND s.flight_id = bp.flight_id
      WHERE bp.ticket_no = ${ticketNo}
        AND bp.flight_id = ${flightId}
    `.execute(this.db);

    if (result.rows.length === 0) {
      throw new NotFoundException(
        `No boarding pass for ticket ${ticketNo} on flight ${flightId}`,
      );
    }

    return {
      ticket_no: ticketNo,
      flight_id: flightId,
      seat_no: result.rows[0].seat_no,
      fare_conditions: result.rows[0].fare_conditions,
    };
  }

  async listAvailableSeats(flightId: number): Promise<AvailableSeatDto[]> {
    const flightCheck = await sql<{ airplane_code: string }>`
      SELECT r.airplane_code
      FROM flights f
      JOIN routes r
           ON r.route_no = f.route_no
          AND r.validity @> f.scheduled_departure
      WHERE f.flight_id = ${flightId}
    `.execute(this.db);

    if (flightCheck.rows.length === 0) {
      throw new NotFoundException(`Flight ${flightId} not found`);
    }

    const result = await sql<AvailableSeatDto>`
      SELECT
        s.seat_no,
        s.fare_conditions,
        NOT EXISTS (
          SELECT 1 FROM boarding_passes bp
          WHERE bp.flight_id = ${flightId} AND bp.seat_no = s.seat_no
        ) AS available
      FROM seats s
      WHERE s.airplane_code = ${flightCheck.rows[0].airplane_code}
      ORDER BY s.seat_no
    `.execute(this.db);

    return result.rows;
  }

  private async fetchSegment(
    ticketNo: string,
    flightId: number,
  ): Promise<SegmentInfo> {
    const result = await sql<SegmentInfo>`
      SELECT
        s.ticket_no,
        s.flight_id,
        s.fare_conditions,
        f.status::text AS status,
        f.scheduled_departure,
        r.airplane_code,
        bookings.now() AS now,
        EXTRACT(EPOCH FROM (f.scheduled_departure - bookings.now())) / 3600
                                                        AS hours_until_departure
      FROM segments s
      JOIN flights f ON f.flight_id = s.flight_id
      JOIN routes r
           ON r.route_no = f.route_no
          AND r.validity @> f.scheduled_departure
      WHERE s.ticket_no = ${ticketNo}
        AND s.flight_id = ${flightId}
    `.execute(this.db);

    if (result.rows.length === 0) {
      throw new NotFoundException(
        `No segment for ticket ${ticketNo} on flight ${flightId}`,
      );
    }

    return result.rows[0];
  }

  private assertCheckinWindow(segment: SegmentInfo): void {
    if (!['Scheduled', 'On Time', 'Delayed'].includes(segment.status)) {
      throw new UnprocessableEntityException(
        `Flight status is ${segment.status}, check-in is closed`,
      );
    }

    const hours = Number(segment.hours_until_departure);

    if (hours <= 0) {
      throw new UnprocessableEntityException('Flight has already departed');
    }

    if (hours > 24) {
      throw new UnprocessableEntityException(
        `Check-in opens 24 hours before departure, (${hours.toFixed(1)} hours left)`,
      );
    }
  }

  private async fetchExistingSeat(
    ticketNo: string,
    flightId: number,
  ): Promise<string> {
    const res = await sql<{ seat_no: string }>`
      SELECT seat_no
      FROM boarding_passes
      WHERE ticket_no = ${ticketNo} AND flight_id = ${flightId}
    `.execute(this.db);

    return res.rows[0].seat_no;
  }

  private async validateRequestedSeat(
    seatNo: string,
    segment: SegmentInfo,
  ): Promise<void> {
    const res = await sql<{ fare_conditions: string; taken: boolean }>`
      SELECT
        se.fare_conditions,
        EXISTS(
          SELECT 1 FROM boarding_passes
          WHERE flight_id = ${segment.flight_id} AND seat_no = ${seatNo}
        ) AS taken
      FROM seats se
      WHERE se.airplane_code = ${segment.airplane_code}
        AND se.seat_no = ${seatNo}
    `.execute(this.db);

    if (res.rows.length === 0) {
      throw new UnprocessableEntityException(
        `Seat ${seatNo} doesn't exist in this aircraft`,
      );
    }

    const row = res.rows[0];
    if (row.fare_conditions !== segment.fare_conditions) {
      throw new UnprocessableEntityException(
        `Seat ${seatNo} is ${row.fare_conditions}, ticket is ${segment.fare_conditions}`,
      );
    }
    if (row.taken) {
      throw new ConflictException(`Seat ${seatNo} is already taken`);
    }
  }

  private async pickFreeSeat(segment: SegmentInfo): Promise<string> {
    const res = await sql<{ seat_no: string }>`
      SELECT s.seat_no
      FROM seats s
      WHERE s.airplane_code = ${segment.airplane_code}
        AND s.fare_conditions = ${segment.fare_conditions}
        AND NOT EXISTS (
          SELECT 1 FROM boarding_passes bp
          WHERE bp.flight_id = ${segment.flight_id} AND bp.seat_no = s.seat_no
        )
      ORDER BY s.seat_no
      LIMIT 1
    `.execute(this.db);

    if (res.rows.length === 0) {
      throw new UnprocessableEntityException(
        `No free ${segment.fare_conditions} seats on this flight`,
      );
    }

    return res.rows[0].seat_no;
  }

  private buildBoardingPass(
    ticketNo: string,
    segment: SegmentInfo,
    seatNo: string,
  ): BoardingPassDto {
    return {
      ticket_no: ticketNo,
      flight_id: segment.flight_id,
      seat_no: seatNo,
      fare_conditions: segment.fare_conditions,
    };
  }
}
