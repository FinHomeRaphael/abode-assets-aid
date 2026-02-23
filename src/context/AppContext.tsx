import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Transaction, Budget, Member, Household, SavingsGoal, SavingsDeposit, CustomCategory, Account, AccountType, DEFAULT_EXCHANGE_RATES, FinanceScope } from '@/types/finance';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatLocalDate } from '@/utils/format';
import { Session } from '@supabase/supabase-js';

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
  const start = formatLocalDate(new Date(y, m, 1));
  const end = formatLocalDate(new Date(y, m + 1, 0));
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
  loading: boolean;
  session: Session | null;
  householdId: string;
  currentUser: Member | null;
  household: Household;
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  savingsDeposits: SavingsDeposit[];
  customCategories: CustomCategory[];
  accounts: Account[];

  financeScope: FinanceScope;
  setFinanceScope: (scope: FinanceScope) => void;
  scopedTransactions: Transaction[];
  scopedBudgets: Budget[];
  scopedSavingsGoals: SavingsGoal[];

  logout: () => void;

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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [householdData, setHouseholdData] = useState<{ name: string; currency: string; createdAt: string; plan: string }>({ name: '', currency: 'EUR', createdAt: '', plan: 'free' });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [savingsDeposits, setSavingsDeposits] = useState<SavingsDeposit[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [financeScope, setFinanceScope] = useState<FinanceScope>(() => {
    return (localStorage.getItem('finehome_scope') as FinanceScope) || 'household';
  });

  const handleSetFinanceScope = useCallback((scope: FinanceScope) => {
    setFinanceScope(scope);
    localStorage.setItem('finehome_scope', scope);
  }, []);

  const isLoggedIn = !!session;

  const household: Household = useMemo(() => ({
    ...householdData,
    members,
  }), [householdData, members]);

  // ===== Fetch user data from Supabase =====
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setLoading(false);
        return;
      }

      const { data: memberRow } = await supabase
        .from('household_members')
        .select('household_id, role')
        .eq('user_id', userId)
        .single();

      if (!memberRow) {
        setLoading(false);
        return;
      }

      const hId = memberRow.household_id;
      setHouseholdId(hId);

      const { data: houseData } = await supabase
        .from('households')
        .select('*')
        .eq('id', hId)
        .single();

      if (!houseData) {
        setLoading(false);
        return;
      }

      setHouseholdData({
        name: houseData.name,
        currency: houseData.default_currency || 'EUR',
        createdAt: houseData.created_at || '',
        plan: (houseData as any).plan || 'free',
      });

      setCurrentUser({
        id: profile.id,
        name: `${profile.first_name} ${(profile as any).last_name || ''}`.trim(),
        email: profile.email,
        role: memberRow.role as 'admin' | 'member',
      });

      // Fetch members
      const { data: allMembers } = await supabase
        .from('household_members')
        .select('user_id, role, profiles(id, first_name, last_name, email)')
        .eq('household_id', hId);

      if (allMembers) {
        setMembers(allMembers.map((m: any) => ({
          id: m.profiles.id,
          name: `${m.profiles.first_name} ${m.profiles.last_name || ''}`.trim(),
          email: m.profiles.email,
          role: m.role as 'admin' | 'member',
        })));
      }

      // Fetch transactions (household + personal for current user)
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .or(`and(household_id.eq.${hId},scope.eq.household),and(created_by.eq.${userId},scope.eq.personal)`)
        .order('date', { ascending: false });

      if (txData) {
        setTransactions(txData.map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          currency: t.currency,
          baseCurrency: t.base_currency,
          exchangeRate: Number(t.exchange_rate),
          convertedAmount: Number(t.converted_amount),
          category: t.category,
          emoji: t.emoji,
          label: t.label,
          date: t.date,
          memberId: t.member_id || userId,
          accountId: t.account_id || undefined,
          notes: t.notes || undefined,
          isRecurring: t.is_recurring || false,
          recurrenceDay: t.recurrence_day || undefined,
          recurringStartMonth: t.recurring_start_month || undefined,
          recurringEndMonth: t.recurring_end_month || undefined,
          recurringSourceId: t.recurring_source_id || undefined,
          isAutoGenerated: t.is_auto_generated || false,
          debtId: t.debt_id || undefined,
          debtPaymentType: t.debt_payment_type || undefined,
          scope: (t.scope as FinanceScope) || 'household',
          createdBy: t.created_by || undefined,
        })));
      }

      // Fetch budgets (household + personal)
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .or(`and(household_id.eq.${hId},scope.eq.household),and(created_by.eq.${userId},scope.eq.personal)`);

      if (budgetData) {
        setBudgets(budgetData.map((b: any) => ({
          id: b.id,
          category: b.category,
          emoji: b.emoji,
          limit: Number(b.limit_amount),
          period: b.period,
          recurring: b.is_recurring ?? true,
          isRecurring: b.is_recurring ?? true,
          alertsEnabled: b.alerts_enabled ?? true,
          monthYear: b.month_year || undefined,
          startMonth: b.start_month,
          endMonth: b.end_month || undefined,
          scope: (b.scope as FinanceScope) || 'household',
          createdBy: b.created_by || undefined,
        })));
      }

      // Fetch savings goals (household + personal)
      const { data: goalsData } = await supabase
        .from('savings_goals')
        .select('*')
        .or(`and(household_id.eq.${hId},scope.eq.household),and(created_by.eq.${userId},scope.eq.personal)`);

      if (goalsData) {
        setSavingsGoals(goalsData.map((g: any) => ({
          id: g.id,
          name: g.name,
          emoji: g.emoji,
          target: Number(g.target_amount),
          currency: g.currency,
          targetDate: g.target_date || undefined,
          scope: (g.scope as FinanceScope) || 'household',
          createdBy: g.created_by || undefined,
        })));
      }

      // Fetch savings deposits
      const { data: depositsData } = await supabase
        .from('savings_deposits')
        .select('*')
        .eq('household_id', hId);

      if (depositsData) {
        setSavingsDeposits(depositsData.map((d: any) => ({
          id: d.id,
          goalId: d.goal_id,
          amount: Number(d.amount),
          date: d.date,
          memberId: d.member_id || userId,
        })));
      }

      // Fetch accounts
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('*')
        .eq('household_id', hId);

      if (accountsData) {
        setAccounts(accountsData.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type as AccountType,
          currency: a.currency,
          startingBalance: Number(a.starting_balance),
          startingDate: a.starting_date,
          isArchived: a.is_archived || false,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        })));
      }

      // Fetch custom categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('household_id', hId)
        .eq('is_default', false);

      if (catData) {
        setCustomCategories(catData.map((c: any) => ({
          name: c.name,
          emoji: c.emoji,
          type: c.type as 'expense' | 'income',
        })));
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== Auth listener =====
  useEffect(() => {
    let isMounted = true;

    const clearUserState = () => {
      setCurrentUser(null);
      setMembers([]);
      setTransactions([]);
      setBudgets([]);
      setSavingsGoals([]);
      setSavingsDeposits([]);
      setCustomCategories([]);
      setAccounts([]);
      setHouseholdData({ name: '', currency: 'EUR', createdAt: '', plan: 'free' });
      setHouseholdId('');
    };

    // Listener for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (newSession?.user) {
        // Defer to avoid Supabase deadlock
        setTimeout(() => {
          if (isMounted) fetchUserData(newSession.user.id);
        }, 0);
      } else {
        clearUserState();
      }
    });

    // INITIAL load (controls loading state)
    const initializeAuth = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(s);
        if (s?.user) {
          await fetchUserData(s.user.id);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // ===== Auth Actions =====
  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    toast.success('Déconnexion réussie');
  };

  // ===== Transaction Actions =====
  const addTransaction = (t: Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>) => {
    const baseCurrency = household.currency;
    const rate = getExchangeRate(t.currency, baseCurrency);
    const convertedAmount = t.amount * rate;
    const monthYear = getMonthYearStr(new Date());
    const newId = crypto.randomUUID();
    const scope = t.scope || financeScope;
    const createdBy = session?.user?.id;
    const newT: Transaction = {
      ...t,
      id: newId,
      exchangeRate: rate,
      baseCurrency,
      convertedAmount,
      recurringStartMonth: t.isRecurring ? monthYear : undefined,
      scope,
      createdBy,
    };
    setTransactions(prev => [newT, ...prev]);

    supabase.from('transactions').insert({
      id: newId,
      household_id: householdId,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      base_currency: baseCurrency,
      exchange_rate: rate,
      converted_amount: convertedAmount,
      category: t.category,
      emoji: t.emoji,
      label: t.label,
      date: t.date,
      member_id: t.memberId,
      account_id: t.accountId || null,
      notes: t.notes || null,
      is_recurring: t.isRecurring || false,
      recurrence_day: t.recurrenceDay || null,
      recurring_start_month: t.isRecurring ? monthYear : null,
      scope,
      created_by: createdBy,
    }).then(({ error }) => { if (error) console.error('Insert tx error:', error); });
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

    const dbUpdates: any = {};
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.label !== undefined) dbUpdates.label = updates.label;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if ('accountId' in updates) dbUpdates.account_id = updates.accountId || null;

    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('transactions').update(dbUpdates).eq('id', id).then(({ error }) => {
        if (error) console.error('Update tx error:', error);
      });
    }
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    supabase.from('transactions').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Delete tx error:', error);
    });
  };

  const softDeleteRecurringTransaction = (id: string, fromMonthYear?: string) => {
    const monthYear = fromMonthYear || getMonthYearStr(new Date());
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, recurringEndMonth: monthYear } : t));
    supabase.from('transactions').update({ recurring_end_month: monthYear }).eq('id', id).then(({ error }) => {
      if (error) console.error('Soft delete recurring error:', error);
    });
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
    supabase.from('transactions').update({ is_recurring: false, recurrence_day: null, recurring_start_month: null, recurring_end_month: null }).eq('id', id).then(({ error }) => {
      if (error) console.error('Delete recurring error:', error);
    });
  };

  const getRecurringTransactions = useCallback(() => {
    return transactions.filter(t => t.isRecurring && !t.recurringSourceId && !t.recurringEndMonth);
  }, [transactions]);

  // ===== Budget Actions =====
  const addBudget = (b: Omit<Budget, 'id' | 'startMonth' | 'endMonth'>) => {
    const monthYear = getMonthYearStr(new Date());
    const newId = crypto.randomUUID();
    const scope = b.scope || financeScope;
    const createdBy = session?.user?.id;
    const newB: Budget = { ...b, id: newId, startMonth: monthYear, scope, createdBy };
    setBudgets(prev => [...prev, newB]);

    supabase.from('budgets').insert({
      id: newId,
      household_id: householdId,
      category: b.category,
      emoji: b.emoji,
      limit_amount: b.limit,
      period: b.period,
      is_recurring: b.isRecurring ?? true,
      alerts_enabled: b.alertsEnabled ?? true,
      start_month: monthYear,
      month_year: b.monthYear || null,
      scope,
      created_by: createdBy,
    }).then(({ error }) => { if (error) console.error('Insert budget error:', error); });
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    const dbUpdates: any = {};
    if (updates.limit !== undefined) dbUpdates.limit_amount = updates.limit;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('budgets').update(dbUpdates).eq('id', id).then(({ error }) => {
        if (error) console.error('Update budget error:', error);
      });
    }
  };

  const deleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
    supabase.from('budgets').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Delete budget error:', error);
    });
  };

  const softDeleteBudget = (id: string) => {
    const monthYear = getMonthYearStr(new Date());
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, endMonth: monthYear } : b));
    supabase.from('budgets').update({ end_month: monthYear }).eq('id', id).then(({ error }) => {
      if (error) console.error('Soft delete budget error:', error);
    });
  };

  // ===== Computed Helpers =====
  const getMemberById = useCallback((id: string) => members.find(m => m.id === id), [members]);

  const getBudgetSpent = useCallback((budget: Budget, refDate: Date = new Date()) => {
    const range = budget.period === 'monthly' ? getMonthRange(refDate) : getYearRange(refDate);
    const userId = session?.user?.id;
    const scopeFilteredTx = transactions.filter(t => {
      if (financeScope === 'personal') return t.scope === 'personal' && t.createdBy === userId;
      return t.scope === 'household' || !t.scope;
    });
    return scopeFilteredTx
      .filter(t => t.type === 'expense' && t.category === budget.category && t.date >= range.start && t.date <= range.end)
      .reduce((sum, t) => sum + t.convertedAmount, 0);
  }, [transactions, financeScope, session?.user?.id]);

  const getBudgetsForMonth = useCallback((refDate: Date) => {
    const monthYear = getMonthYearStr(refDate);
    const userId = session?.user?.id;
    const scopeFilteredBudgets = budgets.filter(b => {
      if (financeScope === 'personal') return b.scope === 'personal' && b.createdBy === userId;
      return b.scope === 'household' || !b.scope;
    });
    return scopeFilteredBudgets.filter(b => {
      if (b.isRecurring) {
        if (b.startMonth > monthYear) return false;
        if (b.endMonth && b.endMonth < monthYear) return false;
        return true;
      }
      return b.monthYear === monthYear;
    });
  }, [budgets, financeScope, session?.user?.id]);

  // ===== Savings Actions =====
  const addSavingsGoal = (g: Omit<SavingsGoal, 'id'>) => {
    const newId = crypto.randomUUID();
    const scope = g.scope || financeScope;
    const createdBy = session?.user?.id;
    const newG: SavingsGoal = { ...g, id: newId, scope, createdBy };
    setSavingsGoals(prev => [...prev, newG]);

    supabase.from('savings_goals').insert({
      id: newId,
      household_id: householdId,
      name: g.name,
      emoji: g.emoji,
      target_amount: g.target,
      target_date: g.targetDate || null,
      currency: g.currency,
      scope,
      created_by: createdBy,
    }).then(({ error }) => { if (error) console.error('Insert goal error:', error); });
  };

  const updateSavingsGoal = (id: string, updates: Partial<Omit<SavingsGoal, 'id'>>) => {
    setSavingsGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const deleteSavingsGoal = (id: string) => {
    setSavingsGoals(prev => prev.filter(g => g.id !== id));
    setSavingsDeposits(prev => prev.filter(d => d.goalId !== id));
    supabase.from('savings_deposits').delete().eq('goal_id', id).then(() => {
      supabase.from('savings_goals').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Delete goal error:', error);
      });
    });
  };

  const addSavingsDeposit = (d: Omit<SavingsDeposit, 'id'>) => {
    const newId = crypto.randomUUID();
    const newD: SavingsDeposit = { ...d, id: newId };
    setSavingsDeposits(prev => [...prev, newD]);

    supabase.from('savings_deposits').insert({
      id: newId,
      household_id: householdId,
      goal_id: d.goalId,
      amount: d.amount,
      date: d.date,
      member_id: d.memberId || null,
    }).then(({ error }) => { if (error) console.error('Insert deposit error:', error); });
  };

  const deleteSavingsDeposit = (id: string) => {
    setSavingsDeposits(prev => prev.filter(d => d.id !== id));
    supabase.from('savings_deposits').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Delete deposit error:', error);
    });
  };

  const getGoalSaved = useCallback((goalId: string) => {
    return savingsDeposits.filter(d => d.goalId === goalId).reduce((s, d) => s + d.amount, 0);
  }, [savingsDeposits]);

  const getGoalDeposits = useCallback((goalId: string) => {
    return savingsDeposits.filter(d => d.goalId === goalId);
  }, [savingsDeposits]);

  const scopedSavingsGoalIds = useMemo(() => {
    const userId = session?.user?.id;
    return new Set(savingsGoals.filter(g => {
      if (financeScope === 'personal') return g.scope === 'personal' && g.createdBy === userId;
      return g.scope === 'household' || !g.scope;
    }).map(g => g.id));
  }, [savingsGoals, financeScope, session?.user?.id]);

  const scopedSavingsDeposits = useMemo(() => {
    return savingsDeposits.filter(d => scopedSavingsGoalIds.has(d.goalId));
  }, [savingsDeposits, scopedSavingsGoalIds]);

  const getMonthSavings = useCallback((refDate: Date = new Date()) => {
    const range = getMonthRange(refDate);
    return scopedSavingsDeposits
      .filter(d => d.date >= range.start && d.date <= range.end)
      .reduce((s, d) => s + d.amount, 0);
  }, [scopedSavingsDeposits]);

  const getTotalSavings = useCallback(() => {
    return scopedSavingsDeposits.reduce((s, d) => s + d.amount, 0);
  }, [scopedSavingsDeposits]);

  // ===== Category Actions =====
  const addCustomCategory = (c: CustomCategory) => {
    setCustomCategories(prev => [...prev, c]);
    supabase.from('categories').insert({
      household_id: householdId,
      name: c.name,
      emoji: c.emoji,
      type: c.type,
      is_default: false,
    }).then(({ error }) => { if (error) console.error('Insert category error:', error); });
  };

  const deleteCustomCategory = (name: string) => {
    setCustomCategories(prev => prev.filter(c => c.name !== name));
    supabase.from('categories').delete().eq('household_id', householdId).eq('name', name).eq('is_default', false).then(({ error }) => {
      if (error) console.error('Delete category error:', error);
    });
  };

  // ===== Transaction Month View (with virtual recurring) =====
  const getTransactionsForMonth = useCallback((refDate: Date) => {
    const range = getMonthRange(refDate);
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const monthStr = String(month + 1).padStart(2, '0');
    const monthYear = `${year}-${monthStr}`;

    const userId = session?.user?.id;
    const scopeFiltered = transactions.filter(t => {
      if (financeScope === 'personal') return t.scope === 'personal' && t.createdBy === userId;
      return t.scope === 'household' || !t.scope;
    });

    const monthTransactions = scopeFiltered.filter(t => t.date >= range.start && t.date <= range.end);
    const recurringTemplates = scopeFiltered.filter(t => t.isRecurring && !t.recurringSourceId);

    for (const template of recurringTemplates) {
      if (template.recurringStartMonth && template.recurringStartMonth > monthYear) continue;
      if (template.recurringEndMonth && monthYear >= template.recurringEndMonth) continue;

      const [tYear, tMonth] = template.date.split('-').map(Number);
      if (tYear === year && tMonth === month + 1) continue;

      const alreadyExists = monthTransactions.some(t => t.recurringSourceId === template.id);
      if (alreadyExists) continue;

      const existsInState = scopeFiltered.some(
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
  }, [transactions, household.currency, financeScope, session?.user?.id]);

  // ===== Household Actions =====
  const changeCurrency = (currency: string) => {
    const newTransactions = transactions.map(t => {
      const rate = getExchangeRate(t.currency, currency);
      return { ...t, exchangeRate: rate, baseCurrency: currency, convertedAmount: t.amount * rate };
    });
    setTransactions(newTransactions);
    setHouseholdData(prev => ({ ...prev, currency }));
    supabase.from('households').update({ default_currency: currency }).eq('id', householdId).then(({ error }) => {
      if (error) console.error('Update currency error:', error);
    });
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
    toast.info('Utilisez la déconnexion pour réinitialiser');
  };

  // ===== Account Actions =====
  const addAccount = (a: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>) => {
    const newId = crypto.randomUUID();
    const newA: Account = {
      ...a,
      id: newId,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAccounts(prev => [...prev, newA]);

    supabase.from('accounts').insert({
      id: newId,
      household_id: householdId,
      name: a.name,
      type: a.type,
      currency: a.currency,
      starting_balance: a.startingBalance,
      starting_date: a.startingDate,
    }).then(({ error }) => { if (error) console.error('Insert account error:', error); });
  };

  const updateAccount = (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
  };

  const archiveAccount = (id: string) => {
    updateAccount(id, { isArchived: true });
    supabase.from('accounts').update({ is_archived: true }).eq('id', id).then(({ error }) => {
      if (error) console.error('Archive account error:', error);
    });
  };

  const deleteAccount = (id: string): boolean => {
    const hasTransactions = transactions.some(t => t.accountId === id);
    if (hasTransactions) return false;
    setAccounts(prev => prev.filter(a => a.id !== id));
    supabase.from('accounts').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Delete account error:', error);
    });
    return true;
  };

  const getAccountBalance = useCallback((accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;
    const txs = transactions.filter(t => t.accountId === accountId);
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return account.startingBalance + income - expense;
  }, [accounts, transactions]);

  const getActiveAccounts = useCallback(() => accounts.filter(a => !a.isArchived), [accounts]);

  const getAccountTransactions = useCallback((accountId: string) => {
    return transactions.filter(t => t.accountId === accountId).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions]);

  // ===== Scoped Data =====
  const scopedTransactions = useMemo(() => {
    const userId = session?.user?.id;
    return transactions.filter(t => {
      if (financeScope === 'personal') return t.scope === 'personal' && t.createdBy === userId;
      return t.scope === 'household' || !t.scope;
    });
  }, [transactions, financeScope, session?.user?.id]);

  const scopedBudgets = useMemo(() => {
    const userId = session?.user?.id;
    return budgets.filter(b => {
      if (financeScope === 'personal') return b.scope === 'personal' && b.createdBy === userId;
      return b.scope === 'household' || !b.scope;
    });
  }, [budgets, financeScope, session?.user?.id]);

  const scopedSavingsGoals = useMemo(() => {
    const userId = session?.user?.id;
    return savingsGoals.filter(g => {
      if (financeScope === 'personal') return g.scope === 'personal' && g.createdBy === userId;
      return g.scope === 'household' || !g.scope;
    });
  }, [savingsGoals, financeScope, session?.user?.id]);

  return (
    <AppContext.Provider value={{
      isLoggedIn, loading, session, householdId, currentUser, household,
      transactions, budgets, savingsGoals, savingsDeposits, customCategories, accounts,
      financeScope, setFinanceScope: handleSetFinanceScope,
      scopedTransactions, scopedBudgets, scopedSavingsGoals,
      logout,
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
