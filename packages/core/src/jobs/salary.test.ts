import { describe, expect, it } from 'vitest';
import { parseSalaryText } from './salary';

describe('parseSalaryText', () => {
  it('parses a range with spaces as thousand separators', () => {
    expect(parseSalaryText('60 000 – 80 000 Kč')).toEqual({ min: 60000, max: 80000, currency: 'CZK', period: 'month' });
  });
  it('expands a short lower bound ("45 - 75.000")', () => {
    expect(parseSalaryText('45 - 75.000 Kč')).toEqual({ min: 45000, max: 75000, currency: 'CZK', period: 'month' });
  });
  it('detects hourly and yearly pay and other currencies', () => {
    expect(parseSalaryText('4 000 Kč/hod')).toEqual({ min: 4000, max: 4000, currency: 'CZK', period: 'hour' });
    expect(parseSalaryText('€ 5000 - 6000 per year')).toEqual({ min: 5000, max: 6000, currency: 'EUR', period: 'year' });
  });
  it('returns undefined when there is no amount or currency', () => {
    expect(parseSalaryText('dohodou')).toBeUndefined();
    expect(parseSalaryText('60 000')).toBeUndefined();
  });
});
