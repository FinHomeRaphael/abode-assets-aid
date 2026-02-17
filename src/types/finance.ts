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

export interface SavingsGoal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  targetDate?: string;
}

export interface SavingsDeposit {
  id: string;
  goalId: string;
  amount: number;
  memberId: string;
  date: string;
}

export interface CustomCategory {
  name: string;
  emoji: string;
  type: 'expense' | 'income';
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
  savingsGoals: SavingsGoal[];
  savingsDeposits: SavingsDeposit[];
  customCategories: CustomCategory[];
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

export const EMOJI_LIST = [
  '🛒','🏠','🚗','💊','🎬','🛍️','📱','📚','✈️','🍽️','🔧','📄','💰','💻','📈','🏛️','📌',
  '🎮','🏋️','🐾','👶','🎁','💇','🧹','🔌','📦','🎵','☕','🍕','🎂','💍','🏥','🚌','🚲','⛽','🧾',
];
