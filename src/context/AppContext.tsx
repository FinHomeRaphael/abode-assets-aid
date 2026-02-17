import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { AppState, Transaction, Budget, Member, Household, SavingsGoal, SavingsDeposit, CustomCategory, DEFAULT_EXCHANGE_RATES } from '@/types/finance';
import { demoMembers, demoHousehold, demoTransactions, demoBudgets, demoSavingsGoals, demoSavingsDeposits } from '@/data/demo';
import { generateId } from '@/utils/format';

const STORAGE_KEY = 'finehome_state';

const defaultState: AppState = {
  isLoggedIn: false,
  isOnboarded: false,
  currentUser: null,
  household: demoHousehold,
  transactions: demoTransactions,
  budgets: demoBudgets,
  savingsGoals: demoSavingsGoals,
  savingsDeposits: demoSavingsDeposits,
  customCategories: [],
};

/** Migrate old transactions that don't have exchange rate fields */
function migrateTransaction(t: any, householdCurrency: string): Transaction {
  if (t.exchangeRate != null && t.baseCurrency && t.convertedAmount != null) return t;
  const rate = getExchangeRate(t.currency || 'EUR', householdCurrency);
  const converted = t.amount * rate;
  return {
    ...t,
    currency: t.currency || 'EUR',
    exchangeRate: rate,
    baseCurrency: householdCurrency,
    convertedAmount: converted,
  };
}

/** Migrate old budgets that don't have new fields */
function migrateBudget(b: any): Budget {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    ...b,
    isRecurring: b.isRecurring ?? b.recurring ?? true,
    startMonth: b.startMonth || monthYear,
    endMonth: b.endMonth ?? null,
    monthYear: b.monthYear,
  };
}

/** Get exchange rate from currency to baseCurrency using default rates */
function getExchangeRate(fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return 1;
  const fromToEur = DEFAULT_EXCHANGE_RATES[fromCurrency] || 1;
  const toToEur = DEFAULT_EXCHANGE_RATES[toCurrency] || 1;
  return fromToEur / toToEur;
}

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const householdCurrency = parsed.household?.currency || 'EUR';
      return {
        ...defaultState,
        ...parsed,
        transactions: (parsed.transactions || demoTransactions).map((t: any) => migrateTransaction(t, householdCurrency)),
        budgets: (parsed.budgets || demoBudgets).map((b: any) => migrateBudget(b)),
        savingsGoals: (parsed.savingsGoals || demoSavingsGoals).map((g: any) => ({
          ...g,
          currency: g.currency || householdCurrency,
        })),
        savingsDeposits: parsed.savingsDeposits || demoSavingsDeposits,
        customCategories: parsed.customCategories || [],
      };
    }
  } catch {}
  return defaultState;
}

function getMonthRange(date: Date): { start: string; end: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1).toISOString().split('T')[0];
  const end = new Date(y, m + 1, 0).toISOString().split('T')[0];
  return { start, end };
}

function getYearRange(date: Date): { start: string; end: string } {
  const y = date.getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

function getMonthYearStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function processRecurringTransactions(transactions: Transaction[], householdCurrency: string): Transaction[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthStr = String(currentMonth + 1).padStart(2, '0');
  const currentMonthYear = `${currentYear}-${monthStr}`;

  const recurringTemplates = transactions.filter(t => t.isRecurring && !t.recurringSourceId);
  const newTransactions: Transaction[] = [];

  for (const template of recurringTemplates) {
    // Skip if recurring has ended before this month
    if (template.recurringEndMonth && template.recurringEndMonth < currentMonthYear) continue;

    const templateDate = new Date(template.date);
    const templateInCurrentMonth = templateDate.getFullYear() === currentYear && templateDate.getMonth() === currentMonth;

    const hasGenerated = transactions.some(
      t => t.recurringSourceId === template.id &&
        t.date.startsWith(`${currentYear}-${monthStr}`)
    );

    if (!templateInCurrentMonth && !hasGenerated) {
      const day = template.recurrenceDay || parseInt(template.date.split('-')[2]) || 1;
      const maxDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const safeDay = Math.min(day, maxDay);
      const dateStr = `${currentYear}-${monthStr}-${String(safeDay).padStart(2, '0')}`;

      const rate = getExchangeRate(template.currency, householdCurrency);
      newTransactions.push({
        ...template,
        id: generateId(),
        date: dateStr,
        isRecurring: false,
        recurrenceDay: undefined,
        recurringSourceId: template.id,
        exchangeRate: rate,
        baseCurrency: householdCurrency,
        convertedAmount: template.amount * rate,
      });
    }
  }

  return newTransactions.length > 0 ? [...transactions, ...newTransactions] : transactions;
}

interface AppContextType extends AppState {
  login: (email: string) => void;
  logout: () => void;
  completeOnboarding: (householdName: string, currency: string) => void;
  addTransaction: (t: Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>) => void;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>>) => void;
  deleteTransaction: (id: string) => void;
  softDeleteRecurringTransaction: (id: string) => void;
  toggleRecurring: (id: string) => void;
  deleteRecurring: (id: string) => void;
  getRecurringTransactions: () => Transaction[];
  addBudget: (b: Omit<Budget, 'id' | 'startMonth' | 'endMonth'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  softDeleteBudget: (id: string) => void;
  getMemberById: (id: string) => Member | undefined;
  getBudgetSpent: (budget: Budget, refDate?: Date) => number;
  getBudgetsForMonth: (refDate: Date) => Budget[];
  addSavingsGoal: (g: Omit<SavingsGoal, 'id'>) => void;
  addSavingsDeposit: (d: Omit<SavingsDeposit, 'id'>) => void;
  getGoalSaved: (goalId: string) => number;
  getMonthSavings: (refDate?: Date) => number;
  getTotalSavings: () => number;
  addCustomCategory: (c: CustomCategory) => void;
  deleteCustomCategory: (name: string) => void;
  getTransactionsForMonth: (refDate: Date) => Transaction[];
  changeCurrency: (currency: string) => void;
  addMember: (name: string, email: string, role: 'admin' | 'member') => void;
  removeMember: (id: string) => void;
  updateMemberRole: (id: string, role: 'admin' | 'member') => void;
  resetDemo: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const loaded = loadState();
    if (loaded.isLoggedIn) {
      return { ...loaded, transactions: processRecurringTransactions(loaded.transactions, loaded.household.currency) };
    }
    return loaded;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = (email: string) => {
    const member = state.household.members.find(m => m.email === email) || demoMembers[0];
    setState(prev => {
      const updated = { ...prev, isLoggedIn: true, isOnboarded: true, currentUser: member };
      return { ...updated, transactions: processRecurringTransactions(updated.transactions, updated.household.currency) };
    });
  };

  const logout = () => {
    setState(prev => ({ ...prev, isLoggedIn: false, currentUser: null }));
  };

  const completeOnboarding = (householdName: string, currency: string) => {
    setState(prev => ({
      ...prev,
      isOnboarded: true,
      household: { ...prev.household, name: householdName, currency },
    }));
  };

  const addTransaction = (t: Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>) => {
    const baseCurrency = state.household.currency;
    const rate = getExchangeRate(t.currency, baseCurrency);
    const convertedAmount = t.amount * rate;
    const now = new Date();
    const monthYear = getMonthYearStr(now);
    const newT: Transaction = {
      ...t,
      id: generateId(),
      exchangeRate: rate,
      baseCurrency,
      convertedAmount,
      recurringStartMonth: t.isRecurring ? monthYear : undefined,
      recurringEndMonth: t.isRecurring ? null : undefined,
    };
    setState(prev => ({ ...prev, transactions: [newT, ...prev.transactions] }));
  };

  const updateTransaction = (id: string, updates: Partial<Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>>) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => {
        if (t.id !== id) return t;
        const merged = { ...t, ...updates };
        // If amount or currency changed, recalculate conversion
        if (updates.amount !== undefined || updates.currency !== undefined) {
          const baseCurrency = prev.household.currency;
          const rate = getExchangeRate(merged.currency, baseCurrency);
          merged.exchangeRate = rate;
          merged.baseCurrency = baseCurrency;
          merged.convertedAmount = merged.amount * rate;
        }
        return merged as Transaction;
      }),
    }));
  };

  const deleteTransaction = (id: string) => {
    setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
  };

  const softDeleteRecurringTransaction = (id: string) => {
    const now = new Date();
    const monthYear = getMonthYearStr(now);
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t =>
        t.id === id ? { ...t, recurringEndMonth: monthYear } : t
      ),
    }));
  };

  const toggleRecurring = (id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => {
        if (t.id !== id) return t;
        const day = parseInt(t.date.split('-')[2]) || 1;
        const now = new Date();
        const monthYear = getMonthYearStr(now);
        return {
          ...t,
          isRecurring: !t.isRecurring,
          recurrenceDay: !t.isRecurring ? day : undefined,
          recurringStartMonth: !t.isRecurring ? monthYear : undefined,
          recurringEndMonth: !t.isRecurring ? null : undefined,
        };
      }),
    }));
  };

  const deleteRecurring = (id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t =>
        t.id === id ? { ...t, isRecurring: false, recurrenceDay: undefined, recurringStartMonth: undefined, recurringEndMonth: undefined } : t
      ),
    }));
  };

  const getRecurringTransactions = useCallback(() => {
    return state.transactions.filter(t => t.isRecurring && !t.recurringSourceId && !t.recurringEndMonth);
  }, [state.transactions]);

  const addBudget = (b: Omit<Budget, 'id' | 'startMonth' | 'endMonth'>) => {
    const now = new Date();
    const monthYear = getMonthYearStr(now);
    setState(prev => ({
      ...prev,
      budgets: [...prev.budgets, {
        ...b,
        id: generateId(),
        startMonth: monthYear,
        endMonth: null,
        monthYear: b.isRecurring ? undefined : (b.monthYear || monthYear),
      }],
    }));
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setState(prev => ({ ...prev, budgets: prev.budgets.map(b => b.id === id ? { ...b, ...updates } : b) }));
  };

  const deleteBudget = (id: string) => {
    setState(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== id) }));
  };

  const softDeleteBudget = (id: string) => {
    const now = new Date();
    const monthYear = getMonthYearStr(now);
    setState(prev => ({
      ...prev,
      budgets: prev.budgets.map(b => b.id === id ? { ...b, endMonth: monthYear } : b),
    }));
  };

  const getMemberById = (id: string) => state.household.members.find(m => m.id === id);

  const getBudgetSpent = useCallback((budget: Budget, refDate: Date = new Date()) => {
    const range = budget.period === 'monthly' ? getMonthRange(refDate) : getYearRange(refDate);
    return state.transactions
      .filter(t => t.type === 'expense' && t.category === budget.category && t.date >= range.start && t.date <= range.end)
      .reduce((sum, t) => sum + t.convertedAmount, 0);
  }, [state.transactions]);

  const getBudgetsForMonth = useCallback((refDate: Date) => {
    const monthYear = getMonthYearStr(refDate);
    return state.budgets.filter(b => {
      if (b.isRecurring) {
        if (b.startMonth > monthYear) return false;
        if (b.endMonth && b.endMonth < monthYear) return false;
        return true;
      }
      return b.monthYear === monthYear;
    });
  }, [state.budgets]);

  const addSavingsGoal = (g: Omit<SavingsGoal, 'id'>) => {
    setState(prev => ({ ...prev, savingsGoals: [...prev.savingsGoals, { ...g, id: generateId() }] }));
  };

  const addSavingsDeposit = (d: Omit<SavingsDeposit, 'id'>) => {
    setState(prev => ({ ...prev, savingsDeposits: [...prev.savingsDeposits, { ...d, id: generateId() }] }));
  };

  const getGoalSaved = useCallback((goalId: string) => {
    return state.savingsDeposits.filter(d => d.goalId === goalId).reduce((s, d) => s + d.amount, 0);
  }, [state.savingsDeposits]);

  const getMonthSavings = useCallback((refDate: Date = new Date()) => {
    const range = getMonthRange(refDate);
    return state.savingsDeposits
      .filter(d => d.date >= range.start && d.date <= range.end)
      .reduce((s, d) => s + d.amount, 0);
  }, [state.savingsDeposits]);

  const getTotalSavings = useCallback(() => {
    return state.savingsDeposits.reduce((s, d) => s + d.amount, 0);
  }, [state.savingsDeposits]);

  const addCustomCategory = (c: CustomCategory) => {
    setState(prev => ({ ...prev, customCategories: [...prev.customCategories, c] }));
  };

  const deleteCustomCategory = (name: string) => {
    setState(prev => ({ ...prev, customCategories: prev.customCategories.filter(c => c.name !== name) }));
  };

  const getTransactionsForMonth = useCallback((refDate: Date) => {
    const range = getMonthRange(refDate);
    return state.transactions.filter(t => t.date >= range.start && t.date <= range.end);
  }, [state.transactions]);

  const changeCurrency = (currency: string) => {
    setState(prev => ({ ...prev, household: { ...prev.household, currency } }));
  };

  const addMember = (name: string, email: string, role: 'admin' | 'member') => {
    const newMember: Member = { id: generateId(), name, email, role };
    setState(prev => ({
      ...prev,
      household: { ...prev.household, members: [...prev.household.members, newMember] },
    }));
  };

  const removeMember = (id: string) => {
    setState(prev => ({
      ...prev,
      household: { ...prev.household, members: prev.household.members.filter(m => m.id !== id) },
    }));
  };

  const updateMemberRole = (id: string, role: 'admin' | 'member') => {
    setState(prev => ({
      ...prev,
      household: {
        ...prev.household,
        members: prev.household.members.map(m => m.id === id ? { ...m, role } : m),
      },
    }));
  };

  const resetDemo = () => {
    const fresh = { ...defaultState, isLoggedIn: true, isOnboarded: true, currentUser: demoMembers[0] };
    setState({ ...fresh, transactions: processRecurringTransactions(fresh.transactions, fresh.household.currency) });
  };

  return (
    <AppContext.Provider value={{
      ...state, login, logout, completeOnboarding,
      addTransaction, updateTransaction, deleteTransaction, softDeleteRecurringTransaction,
      toggleRecurring, deleteRecurring, getRecurringTransactions,
      addBudget, updateBudget, deleteBudget, softDeleteBudget,
      getMemberById, getBudgetSpent, getBudgetsForMonth,
      addSavingsGoal, addSavingsDeposit, getGoalSaved, getMonthSavings, getTotalSavings,
      addCustomCategory, deleteCustomCategory, getTransactionsForMonth,
      changeCurrency, addMember, removeMember, updateMemberRole,
      resetDemo,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
