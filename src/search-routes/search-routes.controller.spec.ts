import { Test, TestingModule } from '@nestjs/testing';
import { SearchRoutesController } from './search-routes.controller';

describe('SearchRoutesController', () => {
  let controller: SearchRoutesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchRoutesController],
    }).compile();

    controller = module.get<SearchRoutesController>(SearchRoutesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
