import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleService } from './schedule.service';
import { KYSELY } from '../db/db.module';

describe('ScheduleService', () => {
  let service: ScheduleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScheduleService, { provide: KYSELY, useValue: {} }],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
