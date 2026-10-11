export interface Salary {
  min: number | null;
  max: number | null;
  currency: string;
  period: string;
}

const CURRENCIES: [RegExp, string][] = [
  [/kč|czk/i, 'CZK'],
  [/€|eur/i, 'EUR'],
  [/\$|usd/i, 'USD'],
];

function toNumber(raw: string): number | null {
  const compact = raw.replace(/[\s ]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const value = Number(compact);
  return compact !== '' && Number.isFinite(value) ? value : null;
}

/** Parses text like "60 000 – 80 000 Kč" or "4 000 Kč/hod". Returns undefined without an amount and a currency. */
export function parseSalaryText(text: string): Salary | undefined {
  const currency = CURRENCIES.find(([pattern]) => pattern.test(text))?.[1];
  if (currency === undefined) return undefined;
  const numbers = (text.match(/\d[\d\s .,]*\d|\d/g) ?? []).map(toNumber).filter((n): n is number => n !== null);
  if (numbers.length === 0) return undefined;
  let min = numbers[0]!;
  let max = numbers.length >= 2 ? numbers[1]! : min;
  if (numbers.length >= 2 && min < 1000 && max >= 10000) min *= 1000;
  if (min > max) [min, max] = [max, min];
  const period = /hod|hour|\/h\b/i.test(text) ? 'hour' : /rok|year|annual/i.test(text) ? 'year' : 'month';
  return { min, max, currency, period };
}
