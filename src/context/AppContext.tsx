import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppState, Transaction, Budget, Investment, Member, Household } from '@/types/finance';
import { demoMembers, demoHousehold, demoTransactions, demoBudgets, demoInvestments } from '@/data/demo';
import { generateId } from '@/utils/format';

const STORAGE_KEY = 'finehome_state';

const defaultState: AppState = {
  isLoggedIn: false,
  isOnboarded: false,
  currentUser: null,
  household: demoHousehold,
  transactions: demoTransactions,
  budgets: demoBudgets,
  investments: demoInvestments,
};

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
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

interface AppContextType extends AppState {
  login: (email: string) => void;
  logout: () => void;
  completeOnboarding: (householdName: string, currency: string) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (b: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  addInvestment: (i: Omit<Investment, 'id'>) => void;
  getMemberById: (id: string) => Member | undefined;
  getBudgetSpent: (budget: Budget, refDate?: Date) => number;
  resetDemo: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = (email: string) => {
    const member = state.household.members.find(m => m.email === email) || demoMembers[0];
    setState(prev => ({ ...prev, isLoggedIn: true, isOnboarded: true, currentUser: member }));
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
    setState(prev => ({
      ...prev,
      transactions: [newT, ...prev.transactions],
    }));
  };

  const deleteTransaction = (id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id),
    }));
  };

  const addBudget = (b: Omit<Budget, 'id'>) => {
    setState(prev => ({
      ...prev,
      budgets: [...prev.budgets, { ...b, id: generateId() }],
    }));
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setState(prev => ({
      ...prev,
      budgets: prev.budgets.map(b => b.id === id ? { ...b, ...updates } : b),
    }));
  };

  const addInvestment = (i: Omit<Investment, 'id'>) => {
    setState(prev => ({
      ...prev,
      investments: [...prev.investments, { ...i, id: generateId() }],
    }));
  };

  const getMemberById = (id: string) => state.household.members.find(m => m.id === id);

  const getBudgetSpent = useCallback((budget: Budget, refDate: Date = new Date()) => {
    const range = budget.period === 'monthly' ? getMonthRange(refDate) : getYearRange(refDate);
    return state.transactions
      .filter(t => t.type === 'expense' && t.category === budget.category && t.date >= range.start && t.date <= range.end)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [state.transactions]);

  const resetDemo = () => {
    setState({ ...defaultState, isLoggedIn: true, isOnboarded: true, currentUser: demoMembers[0] });
  };

  return (
    <AppContext.Provider value={{
      ...state, login, logout, completeOnboarding,
      addTransaction, deleteTransaction, addBudget, updateBudget,
      addInvestment, getMemberById, getBudgetSpent, resetDemo,
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
