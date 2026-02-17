import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { AppState, Transaction, Budget, Member, Household, SavingsGoal, SavingsDeposit, CustomCategory } from '@/types/finance';
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

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultState,
        ...parsed,
        savingsGoals: parsed.savingsGoals || demoSavingsGoals,
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

/**
 * Process recurring transactions: for each recurring template,
 * check if a transaction exists for the current month. If not, create one.
 */
function processRecurringTransactions(transactions: Transaction[]): Transaction[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthStr = String(currentMonth + 1).padStart(2, '0');

  const recurringTemplates = transactions.filter(t => t.isRecurring && !t.recurringSourceId);
  const newTransactions: Transaction[] = [];

  for (const template of recurringTemplates) {
    // Check if a transaction already exists for this month (either the template itself or a generated one)
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

      newTransactions.push({
        ...template,
        id: generateId(),
        date: dateStr,
        isRecurring: false,
        recurrenceDay: undefined,
        recurringSourceId: template.id,
      });
    }
  }

  return newTransactions.length > 0 ? [...transactions, ...newTransactions] : transactions;
}

interface AppContextType extends AppState {
  login: (email: string) => void;
  logout: () => void;
  completeOnboarding: (householdName: string, currency: string) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  toggleRecurring: (id: string) => void;
  deleteRecurring: (id: string) => void;
  getRecurringTransactions: () => Transaction[];
  addBudget: (b: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  getMemberById: (id: string) => Member | undefined;
  getBudgetSpent: (budget: Budget, refDate?: Date) => number;
  addSavingsGoal: (g: Omit<SavingsGoal, 'id'>) => void;
  addSavingsDeposit: (d: Omit<SavingsDeposit, 'id'>) => void;
  getGoalSaved: (goalId: string) => number;
  getMonthSavings: (refDate?: Date) => number;
  getTotalSavings: () => number;
  addCustomCategory: (c: CustomCategory) => void;
  deleteCustomCategory: (name: string) => void;
  getTransactionsForMonth: (refDate: Date) => Transaction[];
  resetDemo: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const loaded = loadState();
    // Process recurring transactions on load
    if (loaded.isLoggedIn) {
      return { ...loaded, transactions: processRecurringTransactions(loaded.transactions) };
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
      return { ...updated, transactions: processRecurringTransactions(updated.transactions) };
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

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newT = { ...t, id: generateId() };
    setState(prev => ({ ...prev, transactions: [newT, ...prev.transactions] }));
  };

  const deleteTransaction = (id: string) => {
    setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
  };

  const toggleRecurring = (id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => {
        if (t.id !== id) return t;
        const day = parseInt(t.date.split('-')[2]) || 1;
        return {
          ...t,
          isRecurring: !t.isRecurring,
          recurrenceDay: !t.isRecurring ? day : undefined,
        };
      }),
    }));
  };

  const deleteRecurring = (id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t =>
        t.id === id ? { ...t, isRecurring: false, recurrenceDay: undefined } : t
      ),
    }));
  };

  const getRecurringTransactions = useCallback(() => {
    return state.transactions.filter(t => t.isRecurring && !t.recurringSourceId);
  }, [state.transactions]);

  const addBudget = (b: Omit<Budget, 'id'>) => {
    setState(prev => ({ ...prev, budgets: [...prev.budgets, { ...b, id: generateId() }] }));
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setState(prev => ({ ...prev, budgets: prev.budgets.map(b => b.id === id ? { ...b, ...updates } : b) }));
  };

  const deleteBudget = (id: string) => {
    setState(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== id) }));
  };

  const getMemberById = (id: string) => state.household.members.find(m => m.id === id);

  const getBudgetSpent = useCallback((budget: Budget, refDate: Date = new Date()) => {
    const range = budget.period === 'monthly' ? getMonthRange(refDate) : getYearRange(refDate);
    return state.transactions
      .filter(t => t.type === 'expense' && t.category === budget.category && t.date >= range.start && t.date <= range.end)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [state.transactions]);

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

  const resetDemo = () => {
    const fresh = { ...defaultState, isLoggedIn: true, isOnboarded: true, currentUser: demoMembers[0] };
    setState({ ...fresh, transactions: processRecurringTransactions(fresh.transactions) });
  };

  return (
    <AppContext.Provider value={{
      ...state, login, logout, completeOnboarding,
      addTransaction, deleteTransaction, toggleRecurring, deleteRecurring, getRecurringTransactions,
      addBudget, updateBudget, deleteBudget,
      getMemberById, getBudgetSpent,
      addSavingsGoal, addSavingsDeposit, getGoalSaved, getMonthSavings, getTotalSavings,
      addCustomCategory, deleteCustomCategory, getTransactionsForMonth,
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
