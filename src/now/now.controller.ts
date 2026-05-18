import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NowService } from './now.service';

@ApiTags('Now')
@Controller('now')
export class NowController {
  constructor(private readonly now: NowService) {}

  @Get()
  @ApiOperation({
    summary: 'Текущая дата системы бронирования',
    description:
      'Возвращает текущую дату из БД (bookings.now()) в формате YYYY-MM-DD.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { now: { type: 'string', example: '2025-12-01' } },
    },
  })
  getNow(): Promise<{ now: string }> {
    return this.now.getNow();
  }
}
