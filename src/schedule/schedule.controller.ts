import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import {
  PaginatedInboundFlightsDto,
  PaginationQueryDto,
} from './dto/inbound-schedule.dto';
import { AirportCodePipe } from '../common/pipes/airport-code.pipe';
import { PaginatedOutboundFlightsDto } from './dto/outbound-schedule.dto';

@ApiTags('Schedule')
@Controller('airports/:code')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('inbound')
  @ApiOperation({
    summary: 'Расписание прибытий в аэропорт',
    description:
      'Возвращает конкретные рейсы ' +
      'Поддерживает фильтр по диапазону дат и пагинацию.',
  })
  @ApiOkResponse({ type: PaginatedInboundFlightsDto })
  @ApiNotFoundResponse({ description: 'Аэропорт не найден' })
  inboundFlights(
    @Param('code', AirportCodePipe) code: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedInboundFlightsDto> {
    return this.schedule.listInboundFlights(code, query);
  }

  @Get('outbound')
  @ApiOperation({
    summary: 'Расписание вылетов из аэропорта',
    description:
      'Возвращает конкретные рейсы ' +
      'Поддерживает фильтр по диапазону дат и пагинацию.',
  })
  @ApiOkResponse({ type: PaginatedOutboundFlightsDto })
  outboundFlights(
    @Param('code', AirportCodePipe) code: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedOutboundFlightsDto> {
    return this.schedule.listOutboundFlights(code, query);
  }
}
