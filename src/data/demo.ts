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

export const demoTransactions: Transaction[] = [
  // Current month
  { id: 't1', type: 'expense', label: 'Carrefour', amount: 127.45, currency: 'EUR', category: 'Alimentation', memberId: '2', date: `${y}-${m}-17`, emoji: '🛒' },
  { id: 't2', type: 'income', label: 'Salaire Thomas', amount: 3250, currency: 'EUR', category: 'Salaire', memberId: '1', date: `${y}-${m}-15`, emoji: '💰', isRecurring: true, recurrenceDay: 15 },
  { id: 't3', type: 'expense', label: 'Netflix', amount: 17.99, currency: 'EUR', category: 'Abonnements', memberId: '1', date: `${y}-${m}-14`, emoji: '📱', isRecurring: true, recurrenceDay: 14 },
  { id: 't4', type: 'expense', label: 'EDF', amount: 89, currency: 'EUR', category: 'Logement', memberId: '2', date: `${y}-${m}-12`, emoji: '🏠', isRecurring: true, recurrenceDay: 12 },
  { id: 't5', type: 'income', label: 'Dividendes ETF', amount: 45.20, currency: 'EUR', category: 'Investissement', memberId: '1', date: `${y}-${m}-10`, emoji: '📈' },
  { id: 't6', type: 'expense', label: 'Essence', amount: 65, currency: 'EUR', category: 'Transport', memberId: '1', date: `${y}-${m}-09`, emoji: '🚗' },
  { id: 't7', type: 'expense', label: 'Zara', amount: 89.90, currency: 'EUR', category: 'Shopping', memberId: '2', date: `${y}-${m}-08`, emoji: '🛍️' },
  { id: 't8', type: 'expense', label: 'Cinéma', amount: 24, currency: 'EUR', category: 'Loisirs', memberId: '3', date: `${y}-${m}-07`, emoji: '🎬' },
  { id: 't9', type: 'income', label: 'Salaire Marie', amount: 2800, currency: 'EUR', category: 'Salaire', memberId: '2', date: `${y}-${m}-05`, emoji: '💰', isRecurring: true, recurrenceDay: 5 },
  { id: 't10', type: 'expense', label: 'Restaurant Le Bistrot', amount: 67.50, currency: 'EUR', category: 'Restaurants', memberId: '1', date: `${y}-${m}-03`, emoji: '🍽️' },
  { id: 't11', type: 'expense', label: 'Pharmacie', amount: 32, currency: 'EUR', category: 'Santé', memberId: '3', date: `${y}-${m}-02`, emoji: '💊' },
  { id: 't12', type: 'expense', label: 'Spotify', amount: 9.99, currency: 'EUR', category: 'Abonnements', memberId: '3', date: `${y}-${m}-01`, emoji: '📱', isRecurring: true, recurrenceDay: 1 },
  // Previous month
  { id: 't13', type: 'income', label: 'Salaire Thomas', amount: 3250, currency: 'EUR', category: 'Salaire', memberId: '1', date: `${py}-${pmStr}-15`, emoji: '💰', recurringSourceId: 't2' },
  { id: 't14', type: 'income', label: 'Salaire Marie', amount: 2800, currency: 'EUR', category: 'Salaire', memberId: '2', date: `${py}-${pmStr}-05`, emoji: '💰', recurringSourceId: 't9' },
  { id: 't15', type: 'expense', label: 'Courses Leclerc', amount: 98.30, currency: 'EUR', category: 'Alimentation', memberId: '2', date: `${py}-${pmStr}-16`, emoji: '🛒' },
  { id: 't16', type: 'expense', label: 'Assurance auto', amount: 75, currency: 'EUR', category: 'Transport', memberId: '1', date: `${py}-${pmStr}-10`, emoji: '🚗' },
  { id: 't17', type: 'expense', label: 'Restaurant', amount: 45, currency: 'EUR', category: 'Restaurants', memberId: '1', date: `${py}-${pmStr}-08`, emoji: '🍽️' },
  { id: 't18', type: 'expense', label: 'Bowling', amount: 35, currency: 'EUR', category: 'Loisirs', memberId: '3', date: `${py}-${pmStr}-06`, emoji: '🎬' },
  { id: 't19', type: 'expense', label: 'EDF', amount: 92, currency: 'EUR', category: 'Logement', memberId: '2', date: `${py}-${pmStr}-12`, emoji: '🏠', recurringSourceId: 't4' },
  { id: 't20', type: 'expense', label: 'Netflix', amount: 17.99, currency: 'EUR', category: 'Abonnements', memberId: '1', date: `${py}-${pmStr}-14`, emoji: '📱', recurringSourceId: 't3' },
  { id: 't21', type: 'expense', label: 'Spotify', amount: 9.99, currency: 'EUR', category: 'Abonnements', memberId: '3', date: `${py}-${pmStr}-01`, emoji: '📱', recurringSourceId: 't12' },
];

export const demoBudgets: Budget[] = [
  { id: 'b1', category: 'Alimentation', limit: 600, period: 'monthly', emoji: '🛒', alertsEnabled: true, recurring: true },
  { id: 'b2', category: 'Transport', limit: 200, period: 'monthly', emoji: '🚗', alertsEnabled: true, recurring: true },
  { id: 'b3', category: 'Loisirs', limit: 150, period: 'monthly', emoji: '🎬', alertsEnabled: true, recurring: true },
  { id: 'b4', category: 'Logement', limit: 1200, period: 'monthly', emoji: '🏠', alertsEnabled: false, recurring: true },
  { id: 'b5', category: 'Abonnements', limit: 50, period: 'monthly', emoji: '📱', alertsEnabled: true, recurring: true },
  { id: 'b6', category: 'Restaurants', limit: 150, period: 'monthly', emoji: '🍽️', alertsEnabled: false, recurring: true },
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
