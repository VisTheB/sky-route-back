import { Module } from '@nestjs/common';
import { DateShiftService } from './date-shift.service';

@Module({
  providers: [DateShiftService],
})
export class DateShiftModule {}
