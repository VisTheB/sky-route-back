import { Module } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { CheckinController } from './checkin.controller';

@Module({
  providers: [CheckinService],
  controllers: [CheckinController],
})
export class CheckinModule {}
