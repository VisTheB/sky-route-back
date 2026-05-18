import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingDto } from './dto/booking.dto';
import { BookingSummaryDto } from './dto/list-bookings.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { BookingOwnerGuard } from '../auth/booking-owner.guard';
import { CurrentUserUid } from '../auth/current-user.decorator';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Создать бронирование для одного или нескольких пассажиров',
    description:
      'Создаёт бронирование с билетами для всех пассажиров на один и тот же набор рейсов в указанном классе. ' +
      'Цены сегментов берутся из таблицы pricing_rules. Все операции выполняются в одной транзакции.\n\n' +
      'Эндпоинт идемпотентен: клиент обязан передать заголовок `Idempotency-Key` (UUID), ' +
      'сгенерированный один раз на одну попытку бронирования.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Уникальный идентификатор попытки бронирования (например, UUID v4). ' +
      'Генерируется клиентом один раз при открытии формы и не меняется при повторных отправках.',
    example: '8f14e45f-ceea-467a-a3a5-c8d2e6f1ab12',
  })
  @ApiCreatedResponse({
    type: BookingDto,
    description:
      'Бронирование создано. При повторе с тем же `Idempotency-Key` возвращается тот же ответ.',
  })
  @ApiBadRequestResponse({
    description:
      'Невалидный запрос или отсутствует заголовок `Idempotency-Key`',
  })
  @ApiUnauthorizedResponse({
    description: 'Невалидный или отсутствующий Firebase ID-токен',
  })
  @ApiNotFoundResponse({ description: 'Один или несколько рейсов не найдены' })
  @ApiConflictResponse({
    description:
      'Конфликт: повторный `Idempotency-Key` с другим телом запроса, либо дубликат пассажира в бронировании',
  })
  @ApiUnprocessableEntityResponse({ description: 'Нарушение бизнес-правил' })
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUserUid() uid: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<BookingDto> {
    const key = idempotencyKey?.trim();
    if (!key) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.bookings.create(dto, key, uid);
  }

  @Get()
  @ApiOperation({
    summary: 'Список бронирований текущего пользователя',
    description:
      'Возвращает все бронирования, оформленные текущим пользователем (по Firebase uid из токена). ' +
      'Каждое бронирование сворачивается до сводки: даты, суммы, аэропортов начала и конца маршрута, ' +
      'класса обслуживания и количества пассажиров. Сортировка — по дате создания, от новых к старым.',
  })
  @ApiOkResponse({ type: [BookingSummaryDto] })
  @ApiUnauthorizedResponse({
    description: 'Невалидный или отсутствующий Firebase ID-токен',
  })
  listByOwner(@CurrentUserUid() uid: string): Promise<BookingSummaryDto[]> {
    return this.bookings.listByOwner(uid);
  }

  @Get(':bookRef')
  @UseGuards(BookingOwnerGuard)
  @ApiOperation({
    summary: 'Получить бронирование по book_ref',
    description:
      'Возвращает бронирование со всеми билетами и сегментами. ' +
      'Доступ только владельцу - тому, кто его создал.',
  })
  @ApiParam({
    name: 'bookRef',
    example: 'ABC123',
    description: 'Шестисимвольный код бронирования (регистр не важен)',
  })
  @ApiOkResponse({ type: BookingDto })
  @ApiUnauthorizedResponse({
    description: 'Невалидный или отсутствующий Firebase ID-токен',
  })
  @ApiForbiddenResponse({
    description: 'Бронирование принадлежит другому пользователю',
  })
  @ApiNotFoundResponse({ description: 'Бронирование не найдено' })
  getByRef(@Param('bookRef') bookRef: string): Promise<BookingDto> {
    return this.bookings.getByRef(bookRef);
  }
}
