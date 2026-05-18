import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import type { DB } from '../db/schema';
import { KYSELY } from '../db/db.module';

@Injectable()
export class NowService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async getNow(): Promise<{ now: string }> {
    const result = await sql<{ now: string }>`
      SELECT TO_CHAR(bookings.now(), 'YYYY-MM-DD') AS now
    `.execute(this.db);

    return { now: result.rows[0].now };
  }
}
