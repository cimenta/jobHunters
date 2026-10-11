import { InMemoryRepository } from './repository';
import { SHEETS } from './schema';
import { SheetRepository } from './sheet-repository';
import { FakeGrid } from './testing/fake-grid';
import { describeRepositoryContract } from './testing/repository-contract';
import type { Company } from './types';

describeRepositoryContract('InMemoryRepository', () => new InMemoryRepository<Company>());
describeRepositoryContract(
  'SheetRepository on a FakeGrid',
  () => new SheetRepository<Company>('Companies', SHEETS.Companies, FakeGrid.withHeader(SHEETS.Companies)),
);
