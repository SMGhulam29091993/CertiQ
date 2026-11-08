export type Unit = 'count' | 'usd' | 'ratio' | 'hours';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function formatValue(value: number | null, unit: Unit): string {
  if (value === null) return 'Suppressed';
  switch (unit) {
    case 'usd':
      return usd.format(value);
    case 'ratio':
      return pct.format(value);
    case 'hours':
      return `${dec.format(value)} h`;
    case 'count':
      return int.format(value);
  }
}

export function formatCost(usdValue: number | null): string {
  return usdValue === null ? 'cost n/a' : `$${usdValue.toFixed(4)}`;
}
