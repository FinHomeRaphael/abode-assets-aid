import { Member, Transaction, Budget, Household, SavingsGoal, SavingsDeposit } from '@/types/finance';

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

const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');
const pm = now.getMonth() === 0 ? 12 : now.getMonth();
const py = now.getMonth() === 0 ? y - 1 : y;
const pmStr = String(pm).padStart(2, '0');
const currentMonthYear = `${y}-${m}`;
const prevMonthYear = `${py}-${pmStr}`;

// Helper: all demo transactions are in EUR with base EUR, so rate=1
const eur = (overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'label' | 'amount' | 'category' | 'memberId' | 'date' | 'emoji'>): Transaction => ({
  currency: 'EUR',
  exchangeRate: 1,
  baseCurrency: 'EUR',
  convertedAmount: overrides.amount,
  ...overrides,
});

export const demoTransactions: Transaction[] = [
  // Current month
  eur({ id: 't1', type: 'expense', label: 'Carrefour', amount: 127.45, category: 'Alimentation', memberId: '2', date: `${y}-${m}-17`, emoji: '🛒' }),
  eur({ id: 't2', type: 'income', label: 'Salaire Thomas', amount: 3250, category: 'Salaire', memberId: '1', date: `${y}-${m}-15`, emoji: '💰', isRecurring: true, recurrenceDay: 15 }),
  eur({ id: 't3', type: 'expense', label: 'Netflix', amount: 17.99, category: 'Abonnements', memberId: '1', date: `${y}-${m}-14`, emoji: '📱', isRecurring: true, recurrenceDay: 14 }),
  eur({ id: 't4', type: 'expense', label: 'EDF', amount: 89, category: 'Logement', memberId: '2', date: `${y}-${m}-12`, emoji: '🏠', isRecurring: true, recurrenceDay: 12 }),
  eur({ id: 't5', type: 'income', label: 'Dividendes ETF', amount: 45.20, category: 'Investissement', memberId: '1', date: `${y}-${m}-10`, emoji: '📈' }),
  eur({ id: 't6', type: 'expense', label: 'Essence', amount: 65, category: 'Transport', memberId: '1', date: `${y}-${m}-09`, emoji: '🚗' }),
  eur({ id: 't7', type: 'expense', label: 'Zara', amount: 89.90, category: 'Shopping', memberId: '2', date: `${y}-${m}-08`, emoji: '🛍️' }),
  eur({ id: 't8', type: 'expense', label: 'Cinéma', amount: 24, category: 'Loisirs', memberId: '3', date: `${y}-${m}-07`, emoji: '🎬' }),
  eur({ id: 't9', type: 'income', label: 'Salaire Marie', amount: 2800, category: 'Salaire', memberId: '2', date: `${y}-${m}-05`, emoji: '💰', isRecurring: true, recurrenceDay: 5 }),
  eur({ id: 't10', type: 'expense', label: 'Restaurant Le Bistrot', amount: 67.50, category: 'Restaurants', memberId: '1', date: `${y}-${m}-03`, emoji: '🍽️' }),
  eur({ id: 't11', type: 'expense', label: 'Pharmacie', amount: 32, category: 'Santé', memberId: '3', date: `${y}-${m}-02`, emoji: '💊' }),
  eur({ id: 't12', type: 'expense', label: 'Spotify', amount: 9.99, category: 'Abonnements', memberId: '3', date: `${y}-${m}-01`, emoji: '📱', isRecurring: true, recurrenceDay: 1 }),
  // Previous month
  eur({ id: 't13', type: 'income', label: 'Salaire Thomas', amount: 3250, category: 'Salaire', memberId: '1', date: `${py}-${pmStr}-15`, emoji: '💰', recurringSourceId: 't2' }),
  eur({ id: 't14', type: 'income', label: 'Salaire Marie', amount: 2800, category: 'Salaire', memberId: '2', date: `${py}-${pmStr}-05`, emoji: '💰', recurringSourceId: 't9' }),
  eur({ id: 't15', type: 'expense', label: 'Courses Leclerc', amount: 98.30, category: 'Alimentation', memberId: '2', date: `${py}-${pmStr}-16`, emoji: '🛒' }),
  eur({ id: 't16', type: 'expense', label: 'Assurance auto', amount: 75, category: 'Transport', memberId: '1', date: `${py}-${pmStr}-10`, emoji: '🚗' }),
  eur({ id: 't17', type: 'expense', label: 'Restaurant', amount: 45, category: 'Restaurants', memberId: '1', date: `${py}-${pmStr}-08`, emoji: '🍽️' }),
  eur({ id: 't18', type: 'expense', label: 'Bowling', amount: 35, category: 'Loisirs', memberId: '3', date: `${py}-${pmStr}-06`, emoji: '🎬' }),
  eur({ id: 't19', type: 'expense', label: 'EDF', amount: 92, category: 'Logement', memberId: '2', date: `${py}-${pmStr}-12`, emoji: '🏠', recurringSourceId: 't4' }),
  eur({ id: 't20', type: 'expense', label: 'Netflix', amount: 17.99, category: 'Abonnements', memberId: '1', date: `${py}-${pmStr}-14`, emoji: '📱', recurringSourceId: 't3' }),
  eur({ id: 't21', type: 'expense', label: 'Spotify', amount: 9.99, category: 'Abonnements', memberId: '3', date: `${py}-${pmStr}-01`, emoji: '📱', recurringSourceId: 't12' }),
];

export const demoBudgets: Budget[] = [
  { id: 'b1', category: 'Alimentation', limit: 600, period: 'monthly', emoji: '🛒', alertsEnabled: true, recurring: true, isRecurring: true, startMonth: prevMonthYear },
  { id: 'b2', category: 'Transport', limit: 200, period: 'monthly', emoji: '🚗', alertsEnabled: true, recurring: true, isRecurring: true, startMonth: prevMonthYear },
  { id: 'b3', category: 'Loisirs', limit: 150, period: 'monthly', emoji: '🎬', alertsEnabled: true, recurring: true, isRecurring: true, startMonth: prevMonthYear },
  { id: 'b4', category: 'Logement', limit: 1200, period: 'monthly', emoji: '🏠', alertsEnabled: false, recurring: true, isRecurring: true, startMonth: prevMonthYear },
  { id: 'b5', category: 'Abonnements', limit: 50, period: 'monthly', emoji: '📱', alertsEnabled: true, recurring: true, isRecurring: true, startMonth: prevMonthYear },
  { id: 'b6', category: 'Restaurants', limit: 150, period: 'monthly', emoji: '🍽️', alertsEnabled: false, recurring: true, isRecurring: true, startMonth: prevMonthYear },
];

export const demoSavingsGoals: SavingsGoal[] = [
  { id: 'sg1', name: 'Mariage', emoji: '💒', target: 15000, currency: 'EUR', targetDate: `${y + 1}-09-15` },
  { id: 'sg2', name: 'Vacances été', emoji: '🏖️', target: 2000, currency: 'EUR', targetDate: `${y}-07-01` },
  { id: 'sg3', name: 'Impôts 2026', emoji: '📋', target: 3000, currency: 'EUR', targetDate: `${y}-09-30` },
];

export const demoSavingsDeposits: SavingsDeposit[] = [
  { id: 'sd1', goalId: 'sg1', amount: 500, memberId: '1', date: `${py}-${pmStr}-15` },
  { id: 'sd2', goalId: 'sg1', amount: 500, memberId: '2', date: `${py}-${pmStr}-15` },
  { id: 'sd3', goalId: 'sg1', amount: 500, memberId: '1', date: `${y}-${m}-15` },
  { id: 'sd4', goalId: 'sg1', amount: 500, memberId: '2', date: `${y}-${m}-15` },
  { id: 'sd5', goalId: 'sg2', amount: 300, memberId: '1', date: `${py}-${pmStr}-10` },
  { id: 'sd6', goalId: 'sg2', amount: 200, memberId: '2', date: `${py}-${pmStr}-10` },
  { id: 'sd7', goalId: 'sg2', amount: 300, memberId: '1', date: `${y}-${m}-10` },
  { id: 'sd8', goalId: 'sg3', amount: 400, memberId: '1', date: `${py}-${pmStr}-05` },
  { id: 'sd9', goalId: 'sg3', amount: 400, memberId: '2', date: `${py}-${pmStr}-05` },
  { id: 'sd10', goalId: 'sg3', amount: 400, memberId: '1', date: `${y}-${m}-05` },
];
