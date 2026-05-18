import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AirportsService } from './airports.service';
import { CountryAirportsDto } from './dto/country-airports.dto';
import { AirportDetailsDto } from './dto/airport-details.dto';
import { AirportCodePipe } from 'src/common/pipes/airport-code.pipe';

@ApiTags('Airports')
@Controller('airports')
export class AirportsController {
  constructor(private readonly airports: AirportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Список стран с городами и аэропортами',
    description:
      'Группировка: страны → города → списки аэропортов вылета и прилёта. ' +
      'Аэропорт может попасть в оба списка одновременно. ' +
      'Учитываются только действующие маршруты.',
  })
  @ApiOkResponse({ type: [CountryAirportsDto] })
  list(): Promise<CountryAirportsDto[]> {
    return this.airports.listCountriesWithAirports();
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Полная информация об аэропорте по IATA-коду',
    description:
      'Возвращает код, название, страну, город, координаты и таймзону с текущим смещением UTC.',
  })
  @ApiParam({ name: 'code', example: 'SVO', description: 'IATA-код аэропорта' })
  @ApiOkResponse({ type: AirportDetailsDto })
  @ApiNotFoundResponse({ description: 'Аэропорт не найден' })
  getByCode(
    @Param('code', AirportCodePipe) code: string,
  ): Promise<AirportDetailsDto> {
    return this.airports.getAirportByCode(code);
  }
}
