import { Test, TestingModule } from '@nestjs/testing';
import { SearchRoutesService } from './search-routes.service';

describe('SearchRoutesService', () => {
  let service: SearchRoutesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchRoutesService],
    }).compile();

    service = module.get<SearchRoutesService>(SearchRoutesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
