export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  avatar?: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  label: string;
  amount: number;
  currency: string;
  category: string;
  memberId: string;
  date: string;
  notes?: string;
  emoji: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  period: 'monthly' | 'yearly';
  emoji: string;
  alertsEnabled: boolean;
}

export interface Investment {
  id: string;
  name: string;
  type: string;
  value: number;
  variation: number;
  emoji: string;
}

export interface Household {
  name: string;
  currency: string;
  createdAt: string;
  members: Member[];
}

export interface AppState {
  isLoggedIn: boolean;
  isOnboarded: boolean;
  currentUser: Member | null;
  household: Household;
  transactions: Transaction[];
  budgets: Budget[];
  investments: Investment[];
}

export const EXPENSE_CATEGORIES = [
  'Alimentation', 'Logement', 'Transport', 'Santé', 'Loisirs',
  'Shopping', 'Abonnements', 'Éducation', 'Voyages', 'Restaurants',
  'Services', 'Impôts', 'Autre'
] as const;

export const INCOME_CATEGORIES = [
  'Salaire', 'Freelance', 'Investissement', 'Allocation', 'Autre'
] as const;

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;

export const CATEGORY_EMOJIS: Record<string, string> = {
  Alimentation: '🛒',
  Logement: '🏠',
  Transport: '🚗',
  Santé: '💊',
  Loisirs: '🎬',
  Shopping: '🛍️',
  Abonnements: '📱',
  Éducation: '📚',
  Voyages: '✈️',
  Restaurants: '🍽️',
  Services: '🔧',
  Impôts: '📄',
  Salaire: '💰',
  Freelance: '💻',
  Investissement: '📈',
  Allocation: '🏛️',
  Autre: '📌',
};
