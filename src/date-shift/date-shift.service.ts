import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import type { DB } from '../db/schema';
import { KYSELY } from '../db/db.module';

@Injectable()
export class DateShiftService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DateShiftService.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.shift();
    } catch (err) {
      this.logger.error(
        'Date shift failed; continuing with existing dates',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async shift(): Promise<void> {
    const { rows } = await sql<{
      db_date: string;
      today: string;
      delta: number;
    }>`
      SELECT
        (bookings.now())::date::text AS db_date,
        CURRENT_DATE::text AS today,
        (CURRENT_DATE - (bookings.now())::date)::int AS delta
    `.execute(this.db);

    const { db_date: dbDate, today, delta } = rows[0];

    if (delta === 0) {
      this.logger.log(
        `bookings.now() is already today (${dbDate}), no shift needed`,
      );
      return;
    }

    if (delta < 0) {
      this.logger.warn(
        `bookings.now() (${dbDate}) is ahead of today (${today}), ` +
          'skipping shift to avoid moving dates backward',
      );
      return;
    }

    this.logger.log(
      `Shifting all dates forward by ${delta} days (${dbDate} -> ${today})`,
    );

    await this.db.transaction().execute(async (trx) => {
      await sql`
        UPDATE bookings.flights
           SET scheduled_departure = scheduled_departure + make_interval(days => ${delta}),
               scheduled_arrival   = scheduled_arrival   + make_interval(days => ${delta}),
               actual_departure    = actual_departure    + make_interval(days => ${delta}),
               actual_arrival      = actual_arrival      + make_interval(days => ${delta})
      `.execute(trx);

      await sql`
        UPDATE bookings.bookings
           SET book_date = book_date + make_interval(days => ${delta})
      `.execute(trx);

      await sql`
        UPDATE bookings.boarding_passes
           SET boarding_time = boarding_time + make_interval(days => ${delta})
         WHERE boarding_time IS NOT NULL
      `.execute(trx);

      await sql`
        UPDATE bookings.routes
           SET validity = tstzrange(
             lower(validity) + make_interval(days => ${delta}),
             upper(validity) + make_interval(days => ${delta}),
             '[)'
           )
      `.execute(trx);

      await sql`
        DO $$
        BEGIN
          EXECUTE format(
            'CREATE OR REPLACE FUNCTION bookings.now() RETURNS timestamp with time zone '
            || 'LANGUAGE sql IMMUTABLE AS %L',
            format('SELECT %L::timestamp with time zone', CURRENT_DATE::timestamptz)
          );
        END
        $$
      `.execute(trx);
    });

    this.logger.log(`Date shift complete: bookings.now() now returns ${today}`);
  }
}
