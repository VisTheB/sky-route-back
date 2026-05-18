import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { SearchRoutesService } from './search-routes.service';
import { SearchRoutesQueryDto } from './dto/search-routes.dto';
import { RouteOptionDto } from './dto/route-option.dto';

@ApiTags('Routes')
@Controller('routes')
export class SearchRoutesController {
  constructor(private readonly routes: SearchRoutesService) {}

  @Get('search')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60_000)
  @ApiOperation({
    summary: 'Поиск маршрутов между двумя точками',
    description:
      'Находит варианты перелёта из from в to на указанную дату в выбранном классе. ' +
      'from/to могут быть IATA-кодами аэропортов или названиями городов. ' +
      'Возвращает до 60 вариантов, отсортированных по цене, затем по длительности. ' +
      'Ответы кешируются на 60 секунд по полному URL (включая query-параметры) — ' +
      'повторный запрос с теми же параметрами отдаст результат из памяти, не дёргая БД.',
  })
  @ApiOkResponse({ type: [RouteOptionDto] })
  @ApiBadRequestResponse({ description: 'Невалидные параметры запроса' })
  @ApiNotFoundResponse({
    description: 'Точка отправления или назначения не найдена',
  })
  @ApiUnprocessableEntityResponse({ description: 'from и to совпадают' })
  search(@Query() query: SearchRoutesQueryDto): Promise<RouteOptionDto[]> {
    return this.routes.search(query);
  }
}
