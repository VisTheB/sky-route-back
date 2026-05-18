import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB } from './schema';

export const KYSELY = Symbol('KYSELY');

@Global()
@Module({
  providers: [
    {
      provide: KYSELY,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const pool = new Pool({
          host: cfg.get('DB_HOST'),
          port: +cfg.get<string>('DB_PORT')!,
          user: cfg.get('DB_USER'),
          password: cfg.get('DB_PASSWORD'),
          database: cfg.get('DB_NAME'),
        });
        pool.on('connect', (client) => {
          client.query(`SET search_path TO ${cfg.get('DB_SCHEMA')}, public`);
        });
        return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
      },
    },
  ],
  exports: [KYSELY],
})
export class DbModule {}
