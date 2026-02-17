import { Member, Transaction, Budget, Investment, Household } from '@/types/finance';

export const demoMembers: Member[] = [
  { id: '1', name: 'Thomas', email: 'thomas@finehome.app', role: 'admin' },
  { id: '2', name: 'Marie', email: 'marie@finehome.app', role: 'member' },
  { id: '3', name: 'Lucas', email: 'lucas@finehome.app', role: 'member' },
];

export const demoHousehold: Household = {
  name: 'Famille Dupont',
  currency: 'EUR',
  createdAt: '2024-06-15',
  members: demoMembers,
};

// Use current month for demo data so budgets calculate correctly
const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');

export const demoTransactions: Transaction[] = [
  { id: 't1', type: 'expense', label: 'Carrefour', amount: 127.45, currency: 'EUR', category: 'Alimentation', memberId: '2', date: `${y}-${m}-17`, emoji: '🛒' },
  { id: 't2', type: 'income', label: 'Salaire Thomas', amount: 3250, currency: 'EUR', category: 'Salaire', memberId: '1', date: `${y}-${m}-15`, emoji: '💰' },
  { id: 't3', type: 'expense', label: 'Netflix', amount: 17.99, currency: 'EUR', category: 'Abonnements', memberId: '1', date: `${y}-${m}-14`, emoji: '📱' },
  { id: 't4', type: 'expense', label: 'EDF', amount: 89, currency: 'EUR', category: 'Logement', memberId: '2', date: `${y}-${m}-12`, emoji: '🏠' },
  { id: 't5', type: 'income', label: 'Dividendes ETF', amount: 45.20, currency: 'EUR', category: 'Investissement', memberId: '1', date: `${y}-${m}-10`, emoji: '📈' },
  { id: 't6', type: 'expense', label: 'Essence', amount: 65, currency: 'EUR', category: 'Transport', memberId: '1', date: `${y}-${m}-09`, emoji: '🚗' },
  { id: 't7', type: 'expense', label: 'Zara', amount: 89.90, currency: 'EUR', category: 'Shopping', memberId: '2', date: `${y}-${m}-08`, emoji: '🛍️' },
  { id: 't8', type: 'expense', label: 'Cinéma', amount: 24, currency: 'EUR', category: 'Loisirs', memberId: '3', date: `${y}-${m}-07`, emoji: '🎬' },
  { id: 't9', type: 'income', label: 'Salaire Marie', amount: 2800, currency: 'EUR', category: 'Salaire', memberId: '2', date: `${y}-${m}-05`, emoji: '💰' },
  { id: 't10', type: 'expense', label: 'Restaurant Le Bistrot', amount: 67.50, currency: 'EUR', category: 'Restaurants', memberId: '1', date: `${y}-${m}-03`, emoji: '🍽️' },
  { id: 't11', type: 'expense', label: 'Pharmacie', amount: 32, currency: 'EUR', category: 'Santé', memberId: '3', date: `${y}-${m}-02`, emoji: '💊' },
  { id: 't12', type: 'expense', label: 'Spotify', amount: 9.99, currency: 'EUR', category: 'Abonnements', memberId: '3', date: `${y}-${m}-01`, emoji: '📱' },
];

export const demoBudgets: Budget[] = [
  { id: 'b1', category: 'Alimentation', limit: 600, period: 'monthly', emoji: '🛒', alertsEnabled: true },
  { id: 'b2', category: 'Transport', limit: 200, period: 'monthly', emoji: '🚗', alertsEnabled: true },
  { id: 'b3', category: 'Loisirs', limit: 150, period: 'monthly', emoji: '🎬', alertsEnabled: true },
  { id: 'b4', category: 'Logement', limit: 1200, period: 'monthly', emoji: '🏠', alertsEnabled: false },
  { id: 'b5', category: 'Abonnements', limit: 50, period: 'monthly', emoji: '📱', alertsEnabled: true },
  { id: 'b6', category: 'Restaurants', limit: 150, period: 'monthly', emoji: '🍽️', alertsEnabled: false },
];

export const demoInvestments: Investment[] = [
  { id: 'i1', name: 'ETF World', type: 'ETF', value: 12450, variation: 2.4, emoji: '🌍' },
  { id: 'i2', name: 'Livret A', type: 'Épargne', value: 8900, variation: 0.25, emoji: '🏦' },
  { id: 'i3', name: 'PEA Actions', type: 'Actions', value: 5670, variation: -1.2, emoji: '📊' },
];
