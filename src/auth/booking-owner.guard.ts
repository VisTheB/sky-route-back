import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY } from '../db/db.module';
import type { DB } from '../db/schema';
import type { AuthedRequest } from './firebase-auth.guard';

@Injectable()
export class BookingOwnerGuard implements CanActivate {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const uid = req.user?.uid;
    if (!uid) {
      throw new ForbiddenException('Authentication required');
    }

    const ownerUid = await this.resolveOwnerUid(req);

    if (ownerUid !== uid) {
      throw new ForbiddenException('You do not have access to this booking');
    }
    return true;
  }

  private async resolveOwnerUid(req: AuthedRequest): Promise<string | null> {
    const bookRef = (req.params as Record<string, string | undefined>)?.bookRef;
    if (bookRef) {
      const res = await sql<{ created_by_uid: string | null }>`
        SELECT created_by_uid
        FROM bookings
        WHERE book_ref = ${bookRef.toUpperCase()}
      `.execute(this.db);
      if (res.rows.length === 0) {
        throw new NotFoundException(`Booking '${bookRef}' not found`);
      }
      return res.rows[0].created_by_uid;
    }

    const body = req.body as Record<string, unknown> | undefined;
    const query = req.query as Record<string, unknown> | undefined;
    const ticketNo =
      (typeof body?.ticket_no === 'string' ? body.ticket_no : undefined) ??
      (typeof query?.ticket_no === 'string' ? query.ticket_no : undefined);

    if (ticketNo) {
      const res = await sql<{ created_by_uid: string | null }>`
        SELECT b.created_by_uid
        FROM bookings b
        JOIN tickets t ON t.book_ref = b.book_ref
        WHERE t.ticket_no = ${ticketNo}
      `.execute(this.db);
      if (res.rows.length === 0) {
        throw new NotFoundException(`Ticket '${ticketNo}' not found`);
      }
      return res.rows[0].created_by_uid;
    }

    throw new BadRequestException(
      'BookingOwnerGuard: route must provide bookRef param or ticket_no in body/query',
    );
  }
}
