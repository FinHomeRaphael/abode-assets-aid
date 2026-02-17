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
  isRecurring?: boolean;
  recurrenceDay?: number;
  recurringSourceId?: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  period: 'monthly' | 'yearly';
  emoji: string;
  alertsEnabled: boolean;
  recurring: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  currency: string;
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

export const CURRENCIES = [
  // Major
  'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD', 'CNY', 'HKD', 'SGD',
  // Europe
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'ISK', 'RUB', 'UAH', 'TRY',
  // Americas
  'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'BOB', 'PYG', 'VES', 'CRC', 'DOP', 'GTQ', 'HNL', 'JMD', 'TTD', 'BBD', 'BSD',
  // Asia
  'KRW', 'INR', 'IDR', 'MYR', 'THB', 'PHP', 'VND', 'TWD', 'PKR', 'BDT', 'LKR', 'MMK', 'KHR', 'LAK', 'MNT', 'NPR', 'KZT', 'UZS', 'GEL', 'AMD', 'AZN',
  // Middle East
  'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'ILS', 'LBP', 'IQD', 'IRR', 'SYP', 'YER',
  // Africa
  'ZAR', 'EGP', 'NGN', 'KES', 'GHS', 'TZS', 'UGX', 'MAD', 'TND', 'DZD', 'LYD', 'XOF', 'XAF', 'MUR', 'BWP', 'ETB', 'RWF', 'MZN', 'AOA', 'CDF',
  // Oceania
  'FJD', 'PGK', 'WST', 'TOP',
] as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', JPY: '¥', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$',
  CNY: '¥', HKD: 'HK$', SGD: 'S$', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč',
  HUF: 'Ft', RON: 'lei', TRY: '₺', RUB: '₽', UAH: '₴', MXN: 'MX$', BRL: 'R$', ARS: 'AR$',
  KRW: '₩', INR: '₹', IDR: 'Rp', MYR: 'RM', THB: '฿', PHP: '₱', VND: '₫', TWD: 'NT$',
  PKR: '₨', AED: 'د.إ', SAR: '﷼', QAR: 'ر.ق', KWD: 'د.ك', BHD: 'BD', ILS: '₪',
  ZAR: 'R', EGP: 'E£', NGN: '₦', KES: 'KSh', GHS: 'GH₵', MAD: 'MAD', TND: 'DT',
  FJD: 'FJ$',
};

export const CURRENCY_NAMES: Record<string, string> = {
  EUR: 'Euro', USD: 'Dollar américain', GBP: 'Livre sterling', CHF: 'Franc suisse',
  JPY: 'Yen japonais', CAD: 'Dollar canadien', AUD: 'Dollar australien', NZD: 'Dollar néo-zélandais',
  CNY: 'Yuan chinois', HKD: 'Dollar de Hong Kong', SGD: 'Dollar de Singapour',
  SEK: 'Couronne suédoise', NOK: 'Couronne norvégienne', DKK: 'Couronne danoise',
  PLN: 'Złoty polonais', CZK: 'Couronne tchèque', HUF: 'Forint hongrois',
  RON: 'Leu roumain', BGN: 'Lev bulgare', HRK: 'Kuna croate', ISK: 'Couronne islandaise',
  RUB: 'Rouble russe', UAH: 'Hryvnia ukrainienne', TRY: 'Livre turque',
  MXN: 'Peso mexicain', BRL: 'Réal brésilien', ARS: 'Peso argentin',
  CLP: 'Peso chilien', COP: 'Peso colombien', PEN: 'Sol péruvien', UYU: 'Peso uruguayen',
  KRW: 'Won sud-coréen', INR: 'Roupie indienne', IDR: 'Roupie indonésienne',
  MYR: 'Ringgit malaisien', THB: 'Baht thaïlandais', PHP: 'Peso philippin',
  VND: 'Dong vietnamien', TWD: 'Dollar taïwanais', PKR: 'Roupie pakistanaise',
  BDT: 'Taka bangladais', AED: 'Dirham des EAU', SAR: 'Riyal saoudien',
  QAR: 'Riyal qatarien', KWD: 'Dinar koweïtien', BHD: 'Dinar bahreïni',
  OMR: 'Rial omanais', JOD: 'Dinar jordanien', ILS: 'Shekel israélien',
  ZAR: 'Rand sud-africain', EGP: 'Livre égyptienne', NGN: 'Naira nigérian',
  KES: 'Shilling kényan', GHS: 'Cedi ghanéen', TZS: 'Shilling tanzanien',
  MAD: 'Dirham marocain', TND: 'Dinar tunisien', DZD: 'Dinar algérien',
  XOF: 'Franc CFA (BCEAO)', XAF: 'Franc CFA (BEAC)', MUR: 'Roupie mauricienne',
  FJD: 'Dollar fidjien',
};

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
