import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { DbModule } from './db/db.module';
import { AirportsModule } from './airports/airports.module';
import { ScheduleModule } from './schedule/schedule.module';
import { BookingsModule } from './bookings/bookings.module';
import { CheckinModule } from './checkin/checkin.module';
import { SearchRoutesModule } from './search-routes/search-routes.module';
import { NowModule } from './now/now.module';
import { AuthModule } from './auth/auth.module';
import { DateShiftModule } from './date-shift/date-shift.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60_000,
      max: 500,
    }),
    DbModule,
    AuthModule,
    AirportsModule,
    ScheduleModule,
    BookingsModule,
    CheckinModule,
    SearchRoutesModule,
    NowModule,
    DateShiftModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
