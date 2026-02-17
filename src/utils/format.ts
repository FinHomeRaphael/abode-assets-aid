import { CURRENCY_SYMBOLS } from '@/types/finance';

export function formatAmount(amount: number, currency = 'EUR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  // Symbol after number for EUR-style, before for USD-style
  const symbolAfter = ['EUR', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'RUB', 'UAH'];
  return symbolAfter.includes(currency) ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function getBudgetStatus(spent: number, limit: number): 'ok' | 'warning' | 'over' {
  const ratio = spent / limit;
  if (ratio > 1) return 'over';
  if (ratio > 0.8) return 'warning';
  return 'ok';
}
