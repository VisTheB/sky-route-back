import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CheckinService } from './checkin.service';
import {
  AvailableSeatDto,
  AvailableSeatsQueryDto,
  BoardingPassDto,
  BoardingPassQueryDto,
  CheckInRequestDto,
} from './dto/checkin.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { BookingOwnerGuard } from '../auth/booking-owner.guard';

@ApiTags('CheckIn')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  @Post()
  @UseGuards(BookingOwnerGuard)
  @ApiOperation({
    summary: 'Онлайн-регистрация на рейс',
    description:
      'Регистрация открывается за 24 часа до планового вылета, регистрирует пассажира на рейс и выдаёт посадочный талон.' +
      'Если место не указано, назначается первое свободное нужного класса. ' +
      'Повторный вызов возвращает существующий талон (200), новая регистрация - 201.',
  })
  @ApiCreatedResponse({
    type: BoardingPassDto,
    description: 'Регистрация создана',
  })
  @ApiOkResponse({
    type: BoardingPassDto,
    description:
      'Уже зарегистрирован (повторный вызов с тем же или без seat_no)',
  })
  @ApiNotFoundResponse({ description: 'Сегмент (билет на рейсе) не найден' })
  @ApiUnauthorizedResponse({
    description: 'Невалидный или отсутствующий Firebase ID-токен',
  })
  @ApiForbiddenResponse({
    description: 'Билет принадлежит бронированию другого пользователя',
  })
  @ApiConflictResponse({
    description:
      'Место занято другим пассажиром, либо попытка изменить место уже выданного талона',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Окно регистрации не открыто/закрыто, нет свободных мест нужного класса, ' +
      'место не существует или класс места не соответствует билету',
  })
  async checkIn(
    @Body() dto: CheckInRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BoardingPassDto> {
    const { result, created } = await this.checkin.checkIn(dto);
    res.status(created ? 201 : 200);
    return result;
  }

  @Get('boarding-pass')
  @UseGuards(BookingOwnerGuard)
  @ApiOperation({
    summary: 'Получить выданный посадочный талон',
    description:
      'Возвращает посадочный талон пассажира по номеру билета и идентификатору рейса. ' +
      'Если онлайн-регистрация ещё не пройдена - 404.',
  })
  @ApiOkResponse({ type: BoardingPassDto })
  @ApiUnauthorizedResponse({
    description: 'Невалидный или отсутствующий Firebase ID-токен',
  })
  @ApiForbiddenResponse({
    description: 'Билет принадлежит бронированию другого пользователя',
  })
  @ApiNotFoundResponse({ description: 'Посадочный талон не найден' })
  getBoardingPass(
    @Query() query: BoardingPassQueryDto,
  ): Promise<BoardingPassDto> {
    return this.checkin.getBoardingPass(query.ticket_no, query.flight_id);
  }

  @Get('seats')
  @ApiOperation({
    summary: 'Карта мест самолёта на рейсе',
    description:
      'Возвращает все места самолёта данного рейса с классом обслуживания и флагом available ' +
      '(true — свободно, false — уже занято кем-то из зарегистрированных).',
  })
  @ApiOkResponse({ type: [AvailableSeatDto] })
  @ApiUnauthorizedResponse({
    description: 'Невалидный или отсутствующий Firebase ID-токен',
  })
  @ApiNotFoundResponse({ description: 'Рейс не найден' })
  listAvailableSeats(
    @Query() query: AvailableSeatsQueryDto,
  ): Promise<AvailableSeatDto[]> {
    return this.checkin.listAvailableSeats(query.flight_id);
  }
}
