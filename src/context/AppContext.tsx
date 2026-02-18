import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Transaction, Budget, Member, Household, SavingsGoal, SavingsDeposit, CustomCategory, Account, AccountType, DEFAULT_EXCHANGE_RATES } from '@/types/finance';
import { toast } from 'sonner';
import { demoMembers, demoHousehold, demoTransactions, demoBudgets, demoSavingsGoals, demoSavingsDeposits } from '@/data/demo';

// ===== Helpers =====

function getExchangeRate(fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return 1;
  const fromToEur = DEFAULT_EXCHANGE_RATES[fromCurrency] || 1;
  const toToEur = DEFAULT_EXCHANGE_RATES[toCurrency] || 1;
  return fromToEur / toToEur;
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

// ===== Context Type =====

interface AppContextType {
  isLoggedIn: boolean;
  isOnboarded: boolean;
  loading: boolean;
  currentUser: Member | null;
  household: Household;
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  savingsDeposits: SavingsDeposit[];
  customCategories: CustomCategory[];
  accounts: Account[];

  logout: () => void;
  completeOnboarding: (householdName: string, currency: string) => Promise<void>;

  addTransaction: (t: Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>) => void;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>>) => void;
  deleteTransaction: (id: string) => void;
  softDeleteRecurringTransaction: (id: string, fromMonthYear?: string) => void;
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
  updateSavingsGoal: (id: string, updates: Partial<Omit<SavingsGoal, 'id'>>) => void;
  deleteSavingsGoal: (id: string) => void;
  addSavingsDeposit: (d: Omit<SavingsDeposit, 'id'>) => void;
  deleteSavingsDeposit: (id: string) => void;
  getGoalSaved: (goalId: string) => number;
  getGoalDeposits: (goalId: string) => SavingsDeposit[];
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

  addAccount: (a: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>) => void;
  updateAccount: (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => void;
  archiveAccount: (id: string) => void;
  deleteAccount: (id: string) => boolean;
  getAccountBalance: (accountId: string) => number;
  getActiveAccounts: () => Account[];
  getAccountTransactions: (accountId: string) => Transaction[];
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(demoMembers);
  const [householdData, setHouseholdData] = useState(demoHousehold);
  const [transactions, setTransactions] = useState<Transaction[]>(demoTransactions);
  const [budgets, setBudgets] = useState<Budget[]>(demoBudgets);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(demoSavingsGoals);
  const [savingsDeposits, setSavingsDeposits] = useState<SavingsDeposit[]>(demoSavingsDeposits);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Always logged in and onboarded in demo mode
  const isLoggedIn = true;
  const isOnboarded = true;
  const loading = false;

  const currentUser: Member = useMemo(() => demoMembers[0], []);

  const household: Household = useMemo(() => ({
    ...householdData,
    members,
  }), [householdData, members]);

  // ===== Auth Actions (no-op in demo) =====
  const logout = () => { toast.info('Mode démo — pas de déconnexion'); };
  const completeOnboarding = async () => {};

  // ===== Transaction Actions =====
  const addTransaction = (t: Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>) => {
    const baseCurrency = household.currency;
    const rate = getExchangeRate(t.currency, baseCurrency);
    const convertedAmount = t.amount * rate;
    const monthYear = getMonthYearStr(new Date());
    const newT: Transaction = {
      ...t,
      id: `t-${Date.now()}`,
      exchangeRate: rate,
      baseCurrency,
      convertedAmount,
      recurringStartMonth: t.isRecurring ? monthYear : undefined,
    };
    setTransactions(prev => [newT, ...prev]);
  };

  const updateTransaction = (id: string, updates: Partial<Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>>) => {
    const baseCurrency = household.currency;
    setTransactions(prev => prev.map(t => {
      if (t.id !== id) return t;
      const merged = { ...t, ...updates };
      if (updates.amount !== undefined || updates.currency !== undefined) {
        const rate = getExchangeRate(merged.currency, baseCurrency);
        return { ...merged, exchangeRate: rate, baseCurrency, convertedAmount: merged.amount * rate } as Transaction;
      }
      return merged as Transaction;
    }));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const softDeleteRecurringTransaction = (id: string, fromMonthYear?: string) => {
    const monthYear = fromMonthYear || getMonthYearStr(new Date());
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, recurringEndMonth: monthYear } : t));
  };

  const toggleRecurring = (id: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id !== id) return t;
      const day = parseInt(t.date.split('-')[2]) || 1;
      const monthYear = getMonthYearStr(new Date());
      const newIsRecurring = !t.isRecurring;
      return {
        ...t,
        isRecurring: newIsRecurring,
        recurrenceDay: newIsRecurring ? day : undefined,
        recurringStartMonth: newIsRecurring ? monthYear : undefined,
        recurringEndMonth: newIsRecurring ? null : undefined,
      };
    }));
  };

  const deleteRecurring = (id: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, isRecurring: false, recurrenceDay: undefined, recurringStartMonth: undefined, recurringEndMonth: undefined } : t
    ));
  };

  const getRecurringTransactions = useCallback(() => {
    return transactions.filter(t => t.isRecurring && !t.recurringSourceId && !t.recurringEndMonth);
  }, [transactions]);

  // ===== Budget Actions =====
  const addBudget = (b: Omit<Budget, 'id' | 'startMonth' | 'endMonth'>) => {
    const monthYear = getMonthYearStr(new Date());
    const newB: Budget = { ...b, id: `b-${Date.now()}`, startMonth: monthYear };
    setBudgets(prev => [...prev, newB]);
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  const softDeleteBudget = (id: string) => {
    const monthYear = getMonthYearStr(new Date());
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, endMonth: monthYear } : b));
  };

  // ===== Computed Helpers =====
  const getMemberById = useCallback((id: string) => members.find(m => m.id === id), [members]);

  const getBudgetSpent = useCallback((budget: Budget, refDate: Date = new Date()) => {
    const range = budget.period === 'monthly' ? getMonthRange(refDate) : getYearRange(refDate);
    return transactions
      .filter(t => t.type === 'expense' && t.category === budget.category && t.date >= range.start && t.date <= range.end)
      .reduce((sum, t) => sum + t.convertedAmount, 0);
  }, [transactions]);

  const getBudgetsForMonth = useCallback((refDate: Date) => {
    const monthYear = getMonthYearStr(refDate);
    return budgets.filter(b => {
      if (b.isRecurring) {
        if (b.startMonth > monthYear) return false;
        if (b.endMonth && b.endMonth < monthYear) return false;
        return true;
      }
      return b.monthYear === monthYear;
    });
  }, [budgets]);

  // ===== Savings Actions =====
  const addSavingsGoal = (g: Omit<SavingsGoal, 'id'>) => {
    const newG: SavingsGoal = { ...g, id: `sg-${Date.now()}` };
    setSavingsGoals(prev => [...prev, newG]);
  };

  const updateSavingsGoal = (id: string, updates: Partial<Omit<SavingsGoal, 'id'>>) => {
    setSavingsGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const deleteSavingsGoal = (id: string) => {
    setSavingsGoals(prev => prev.filter(g => g.id !== id));
    setSavingsDeposits(prev => prev.filter(d => d.goalId !== id));
  };

  const addSavingsDeposit = (d: Omit<SavingsDeposit, 'id'>) => {
    const newD: SavingsDeposit = { ...d, id: `sd-${Date.now()}` };
    setSavingsDeposits(prev => [...prev, newD]);
  };

  const deleteSavingsDeposit = (id: string) => {
    setSavingsDeposits(prev => prev.filter(d => d.id !== id));
  };

  const getGoalSaved = useCallback((goalId: string) => {
    return savingsDeposits.filter(d => d.goalId === goalId).reduce((s, d) => s + d.amount, 0);
  }, [savingsDeposits]);

  const getGoalDeposits = useCallback((goalId: string) => {
    return savingsDeposits.filter(d => d.goalId === goalId);
  }, [savingsDeposits]);

  const getMonthSavings = useCallback((refDate: Date = new Date()) => {
    const range = getMonthRange(refDate);
    return savingsDeposits
      .filter(d => d.date >= range.start && d.date <= range.end)
      .reduce((s, d) => s + d.amount, 0);
  }, [savingsDeposits]);

  const getTotalSavings = useCallback(() => {
    return savingsDeposits.reduce((s, d) => s + d.amount, 0);
  }, [savingsDeposits]);

  // ===== Category Actions =====
  const addCustomCategory = (c: CustomCategory) => {
    setCustomCategories(prev => [...prev, c]);
  };

  const deleteCustomCategory = (name: string) => {
    setCustomCategories(prev => prev.filter(c => c.name !== name));
  };

  // ===== Transaction Month View (with virtual recurring) =====
  const getTransactionsForMonth = useCallback((refDate: Date) => {
    const range = getMonthRange(refDate);
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const monthStr = String(month + 1).padStart(2, '0');
    const monthYear = `${year}-${monthStr}`;

    const monthTransactions = transactions.filter(t => t.date >= range.start && t.date <= range.end);
    const recurringTemplates = transactions.filter(t => t.isRecurring && !t.recurringSourceId);

    for (const template of recurringTemplates) {
      if (template.recurringStartMonth && template.recurringStartMonth > monthYear) continue;
      if (template.recurringEndMonth && monthYear >= template.recurringEndMonth) continue;

      const [tYear, tMonth] = template.date.split('-').map(Number);
      if (tYear === year && tMonth === month + 1) continue;

      const alreadyExists = monthTransactions.some(t => t.recurringSourceId === template.id);
      if (alreadyExists) continue;

      const existsInState = transactions.some(
        t => t.recurringSourceId === template.id && t.date >= range.start && t.date <= range.end
      );
      if (existsInState) continue;

      const day = template.recurrenceDay || parseInt(template.date.split('-')[2]) || 1;
      const maxDay = new Date(year, month + 1, 0).getDate();
      const safeDay = Math.min(day, maxDay);
      const dateStr = `${year}-${monthStr}-${String(safeDay).padStart(2, '0')}`;

      const baseCurrency = household.currency;
      const rate = getExchangeRate(template.currency, baseCurrency);

      monthTransactions.push({
        ...template,
        id: `recurring-${template.id}-${monthYear}`,
        date: dateStr,
        isRecurring: false,
        recurrenceDay: undefined,
        recurringSourceId: template.id,
        exchangeRate: rate,
        baseCurrency,
        convertedAmount: template.amount * rate,
      });
    }

    return monthTransactions;
  }, [transactions, household.currency]);

  // ===== Household Actions =====
  const changeCurrency = (currency: string) => {
    const newTransactions = transactions.map(t => {
      const rate = getExchangeRate(t.currency, currency);
      return { ...t, exchangeRate: rate, baseCurrency: currency, convertedAmount: t.amount * rate };
    });
    setTransactions(newTransactions);
    setHouseholdData(prev => ({ ...prev, currency }));
  };

  const addMember = (name: string, email: string, role: 'admin' | 'member') => {
    const tempMember: Member = { id: `m-${Date.now()}`, name, email, role };
    setMembers(prev => [...prev, tempMember]);
    toast.success(`${name} ajouté(e) au foyer`);
  };

  const removeMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const updateMemberRole = (id: string, role: 'admin' | 'member') => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
  };

  const resetDemo = () => {
    setMembers(demoMembers);
    setHouseholdData(demoHousehold);
    setTransactions(demoTransactions);
    setBudgets(demoBudgets);
    setSavingsGoals(demoSavingsGoals);
    setSavingsDeposits(demoSavingsDeposits);
    setCustomCategories([]);
    setAccounts([]);
    toast.success('Données de démo réinitialisées ✓');
  };

  // ===== Account Actions =====
  const addAccount = (a: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>) => {
    const newA: Account = {
      ...a,
      id: `acc-${Date.now()}`,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAccounts(prev => [...prev, newA]);
  };

  const updateAccount = (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
  };

  const archiveAccount = (id: string) => {
    updateAccount(id, { isArchived: true });
  };

  const deleteAccount = (id: string): boolean => {
    const hasTransactions = transactions.some(t => t.accountId === id);
    if (hasTransactions) return false;
    setAccounts(prev => prev.filter(a => a.id !== id));
    return true;
  };

  const getAccountBalance = useCallback((accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;
    const txs = transactions.filter(t => t.accountId === accountId && t.date >= account.startingDate);
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return account.startingBalance + income - expense;
  }, [accounts, transactions]);

  const getActiveAccounts = useCallback(() => accounts.filter(a => !a.isArchived), [accounts]);

  const getAccountTransactions = useCallback((accountId: string) => {
    return transactions.filter(t => t.accountId === accountId).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions]);

  return (
    <AppContext.Provider value={{
      isLoggedIn, isOnboarded, loading, currentUser, household,
      transactions, budgets, savingsGoals, savingsDeposits, customCategories, accounts,
      logout, completeOnboarding,
      addTransaction, updateTransaction, deleteTransaction, softDeleteRecurringTransaction,
      toggleRecurring, deleteRecurring, getRecurringTransactions,
      addBudget, updateBudget, deleteBudget, softDeleteBudget,
      getMemberById, getBudgetSpent, getBudgetsForMonth,
      addSavingsGoal, updateSavingsGoal, deleteSavingsGoal,
      addSavingsDeposit, deleteSavingsDeposit,
      getGoalSaved, getGoalDeposits, getMonthSavings, getTotalSavings,
      addCustomCategory, deleteCustomCategory,
      getTransactionsForMonth, changeCurrency,
      addMember, removeMember, updateMemberRole,
      resetDemo,
      addAccount, updateAccount, archiveAccount, deleteAccount,
      getAccountBalance, getActiveAccounts, getAccountTransactions,
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
