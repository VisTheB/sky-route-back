import { Module } from '@nestjs/common';
import { NowService } from './now.service';
import { NowController } from './now.controller';

@Module({
  providers: [NowService],
  controllers: [NowController],
})
export class NowModule {}
