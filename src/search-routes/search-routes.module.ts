import { Module } from '@nestjs/common';
import { SearchRoutesService } from './search-routes.service';
import { SearchRoutesController } from './search-routes.controller';

@Module({
  providers: [SearchRoutesService],
  controllers: [SearchRoutesController],
})
export class SearchRoutesModule {}
