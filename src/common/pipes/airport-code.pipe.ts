import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class AirportCodePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z]{3}$/.test(normalized)) {
      throw new BadRequestException(
        'Airport code must be a 3-letter IATA code',
      );
    }
    return normalized;
  }
}
