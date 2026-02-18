import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Budget, Member, Household, SavingsGoal, SavingsDeposit, CustomCategory, Account, AccountType, DEFAULT_EXCHANGE_RATES } from '@/types/finance';
import { toast } from 'sonner';
import { Session } from '@supabase/supabase-js';

// ===== DB → Client Mappers =====

function mapDbTransaction(row: any): Transaction {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    amount: Number(row.amount),
    currency: row.currency,
    exchangeRate: Number(row.exchange_rate),
    baseCurrency: row.base_currency,
    convertedAmount: Number(row.converted_amount),
    category: row.category,
    emoji: row.emoji || '📌',
    memberId: row.member_id || '',
    date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date,
    notes: row.notes || undefined,
    isRecurring: row.is_recurring || false,
    recurrenceDay: row.recurrence_day || undefined,
    recurringSourceId: row.recurring_source_id || undefined,
    recurringStartMonth: row.recurring_start_month || undefined,
    recurringEndMonth: row.recurring_end_month ?? undefined,
    accountId: row.account_id || undefined,
  };
}

function mapDbBudget(row: any): Budget {
  return {
    id: row.id,
    category: row.category,
    emoji: row.emoji || '📌',
    limit: Number(row.limit_amount),
    period: row.period || 'monthly',
    alertsEnabled: row.alerts_enabled ?? true,
    recurring: row.is_recurring ?? true,
    isRecurring: row.is_recurring ?? true,
    monthYear: row.month_year || undefined,
    startMonth: row.start_month,
    endMonth: row.end_month ?? undefined,
  };
}

function mapDbSavingsGoal(row: any): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    target: Number(row.target_amount),
    currency: row.currency || 'EUR',
    targetDate: row.target_date ? String(row.target_date).split('T')[0] : undefined,
  };
}

function mapDbSavingsDeposit(row: any): SavingsDeposit {
  return {
    id: row.id,
    goalId: row.goal_id,
    amount: Number(row.amount),
    memberId: row.member_id || '',
    date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date,
  };
}

function mapDbAccount(row: any): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    currency: row.currency,
    startingBalance: Number(row.starting_balance),
    startingDate: typeof row.starting_date === 'string' ? row.starting_date.split('T')[0] : row.starting_date,
    isArchived: row.is_archived || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbMember(profile: any, membership: any): Member {
  return {
    id: profile.id,
    name: profile.first_name,
    email: profile.email,
    role: membership.role || 'member',
  };
}

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

const defaultHousehold: Household = {
  name: '',
  currency: 'EUR',
  createdAt: new Date().toISOString(),
  members: [],
};

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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdData, setHouseholdData] = useState<{ name: string; default_currency: string; created_at: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profile, setProfile] = useState<{ id: string; email: string; first_name: string; avatar_color: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [savingsDeposits, setSavingsDeposits] = useState<SavingsDeposit[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const fetchingRef = useRef(false);

  // ===== Auth =====
  useEffect(() => {
    let isMounted = true;

    // Listener for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!isMounted) return;
      setSession(sess);
      if (sess?.user) {
        setLoading(true); // Keep loading while fetchUserData runs
        setTimeout(() => fetchUserData(sess.user), 0);
      } else {
        resetState();
        setLoading(false);
      }
    });

    // INITIAL load (controls loading)
    const initializeAuth = async () => {
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(sess);
        if (sess?.user) {
          await fetchUserData(sess.user);
        }
      } catch (err) {
        console.error('Init auth error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function resetState() {
    setProfile(null);
    setHouseholdId(null);
    setHouseholdData(null);
    setMembers([]);
    setTransactions([]);
    setBudgets([]);
    setSavingsGoals([]);
    setSavingsDeposits([]);
    setDbCategories([]);
    setAccounts([]);
  }

  async function fetchUserData(user: { id: string; email?: string; user_metadata?: any }) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const userId = user.id;
      const meta = user.user_metadata || {};

      // 1. Profile - create if missing
      let { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!profileData) {
        const { data: newProfile, error: profileError } = await supabase.from('profiles').insert({
          id: userId,
          email: user.email || '',
          first_name: meta.first_name || user.email?.split('@')[0] || 'Utilisateur',
        }).select().single();
        
        // If FK violation or any insert error → user may be deleted from auth.users, force logout
        if (profileError) {
          console.error('Profile creation failed, forcing logout:', profileError);
          resetState();
          setSession(null);
          setLoading(false);
          fetchingRef.current = false;
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {}
          try {
            const storageKey = `sb-dxuyvirhlpdbytfqdmbr-auth-token`;
            localStorage.removeItem(storageKey);
            sessionStorage.removeItem(storageKey);
          } catch {}
          return;
        }
        if (newProfile) profileData = newProfile;
      }
      if (profileData) setProfile(profileData as any);

      // 2. Household membership
      const { data: membershipData } = await supabase.from('household_members').select('*').eq('user_id', userId).limit(1).maybeSingle();

      if (!membershipData) {
        // Auto-create household from signup metadata
        if (meta.last_name) {
          try {
            const householdName = `Famille ${meta.last_name}`;
            const cur = meta.currency || 'EUR';
            const { data: newH } = await supabase.from('households').insert({ name: householdName, default_currency: cur }).select().single();
            if (newH) {
              const hId = (newH as any).id;
              await supabase.from('household_members').insert({ household_id: hId, user_id: userId, role: 'admin' });
              setHouseholdId(hId);
              await fetchHouseholdData(hId);
              return;
            }
          } catch (err) {
            console.error('Auto household creation error:', err);
          }
        }
        // No last_name metadata → can't create household, stay on loading/login
        setHouseholdId(null);
        return;
      }

      const hId = membershipData.household_id as string;
      setHouseholdId(hId);
      await fetchHouseholdData(hId);
    } catch (err) {
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  async function fetchHouseholdData(hId: string) {
    const [
      householdRes,
      membersRes,
      transactionsRes,
      budgetsRes,
      goalsRes,
      depositsRes,
      categoriesRes,
      accountsRes,
    ] = await Promise.all([
      supabase.from('households').select('*').eq('id', hId).single(),
      supabase.from('household_members').select('*, profiles(*)').eq('household_id', hId),
      supabase.from('transactions').select('*').eq('household_id', hId).order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('household_id', hId),
      supabase.from('savings_goals').select('*').eq('household_id', hId),
      supabase.from('savings_deposits').select('*').eq('household_id', hId),
      supabase.from('categories').select('*').eq('household_id', hId),
      supabase.from('accounts').select('*').eq('household_id', hId),
    ]);

    if (householdRes.data) setHouseholdData(householdRes.data as any);

    const householdCurrency = (householdRes.data as any)?.default_currency || 'EUR';

    if (membersRes.data) {
      const mapped = (membersRes.data as any[]).map((m: any) => mapDbMember(m.profiles, m));
      setMembers(mapped);
    }

    if (transactionsRes.data) {
      const mapped = (transactionsRes.data as any[]).map(row => {
        const t = mapDbTransaction(row);
        const rate = getExchangeRate(t.currency, householdCurrency);
        return { ...t, exchangeRate: rate, baseCurrency: householdCurrency, convertedAmount: t.amount * rate };
      });
      setTransactions(mapped);
    }

    if (budgetsRes.data) setBudgets((budgetsRes.data as any[]).map(mapDbBudget));
    if (goalsRes.data) setSavingsGoals((goalsRes.data as any[]).map(mapDbSavingsGoal));
    if (depositsRes.data) setSavingsDeposits((depositsRes.data as any[]).map(mapDbSavingsDeposit));
    if (categoriesRes.data) setDbCategories(categoriesRes.data as any[]);
    if (accountsRes.data) setAccounts((accountsRes.data as any[]).map(mapDbAccount));
  }

  // ===== Computed =====
  const isLoggedIn = !!session;
  const isOnboarded = !!householdId;

  const currentUser: Member | null = useMemo(() => {
    if (!profile) return null;
    const membership = members.find(m => m.id === profile.id);
    return {
      id: profile.id,
      name: profile.first_name,
      email: profile.email,
      role: (membership?.role || 'member') as 'admin' | 'member',
    };
  }, [profile, members]);

  const household: Household = useMemo(() => {
    if (!householdData) return defaultHousehold;
    return {
      name: householdData.name,
      currency: householdData.default_currency || 'EUR',
      createdAt: householdData.created_at,
      members,
    };
  }, [householdData, members]);

  const customCategories: CustomCategory[] = useMemo(() => {
    return dbCategories
      .filter((c: any) => !c.is_default)
      .map((c: any) => ({ name: c.name, emoji: c.emoji, type: c.type }));
  }, [dbCategories]);

  // ===== Auth Actions =====
  const logout = async () => {
    // Immediately clear UI state
    resetState();
    setSession(null);
    setLoading(false);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    // Force-clear any persisted session from storage
    try {
      const storageKey = `sb-dxuyvirhlpdbytfqdmbr-auth-token`;
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
    } catch {}
  };

  const completeOnboarding = async (householdName: string, currency: string) => {
    if (!session?.user) throw new Error('Non authentifié');
    const userId = session.user.id;

    // Create household
    const { data: newHousehold, error: hError } = await supabase
      .from('households')
      .insert({ name: householdName, default_currency: currency })
      .select()
      .single();

    if (hError || !newHousehold) {
      console.error('Household creation error:', hError);
      throw new Error(hError?.message || 'Erreur lors de la création du foyer');
    }

    const hId = (newHousehold as any).id;

    // Add current user as admin
    const { error: mError } = await supabase
      .from('household_members')
      .insert({ household_id: hId, user_id: userId, role: 'admin' });

    if (mError) {
      console.error('Membership creation error:', mError);
      throw new Error(mError?.message || 'Erreur lors de l\'ajout au foyer');
    }

    setHouseholdId(hId);
    await fetchHouseholdData(hId);
  };

  // ===== Transaction Actions =====
  const addTransaction = (t: Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>) => {
    if (!householdId) return;
    const baseCurrency = household.currency;
    const rate = getExchangeRate(t.currency, baseCurrency);
    const convertedAmount = t.amount * rate;
    const now = new Date();
    const monthYear = getMonthYearStr(now);

    const dbRow = {
      household_id: householdId,
      member_id: t.memberId || session?.user?.id,
      account_id: t.accountId || null,
      label: t.label,
      amount: t.amount,
      currency: t.currency,
      exchange_rate: rate,
      base_currency: baseCurrency,
      converted_amount: convertedAmount,
      category: t.category,
      emoji: t.emoji,
      type: t.type,
      date: t.date,
      notes: t.notes || null,
      is_recurring: t.isRecurring || false,
      recurrence_day: t.recurrenceDay || null,
      recurring_start_month: t.isRecurring ? monthYear : null,
      recurring_end_month: null,
    };

    supabase.from('transactions').insert(dbRow).select().single().then(({ data, error }) => {
      if (error) { toast.error('Erreur lors de l\'ajout'); console.error(error); return; }
      if (data) {
        const newT = mapDbTransaction(data);
        const r = getExchangeRate(newT.currency, baseCurrency);
        setTransactions(prev => [{ ...newT, exchangeRate: r, baseCurrency, convertedAmount: newT.amount * r }, ...prev]);
      }
    });
  };

  const updateTransaction = (id: string, updates: Partial<Omit<Transaction, 'id' | 'exchangeRate' | 'baseCurrency' | 'convertedAmount'>>) => {
    const baseCurrency = household.currency;
    const dbUpdates: any = {};
    if (updates.label !== undefined) dbUpdates.label = updates.label;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
    if (updates.memberId !== undefined) dbUpdates.member_id = updates.memberId;
    if (updates.accountId !== undefined) dbUpdates.account_id = updates.accountId;
    if (updates.isRecurring !== undefined) dbUpdates.is_recurring = updates.isRecurring;
    if (updates.recurrenceDay !== undefined) dbUpdates.recurrence_day = updates.recurrenceDay || null;

    // Recalculate if amount or currency changed
    setTransactions(prev => prev.map(t => {
      if (t.id !== id) return t;
      const merged = { ...t, ...updates };
      if (updates.amount !== undefined || updates.currency !== undefined) {
        const rate = getExchangeRate(merged.currency, baseCurrency);
        return { ...merged, exchangeRate: rate, baseCurrency, convertedAmount: merged.amount * rate } as Transaction;
      }
      return merged as Transaction;
    }));

    if (updates.amount !== undefined || updates.currency !== undefined) {
      const existing = transactions.find(t => t.id === id);
      const curr = updates.currency || existing?.currency || 'EUR';
      const amt = updates.amount ?? existing?.amount ?? 0;
      const rate = getExchangeRate(curr, baseCurrency);
      dbUpdates.exchange_rate = rate;
      dbUpdates.base_currency = baseCurrency;
      dbUpdates.converted_amount = amt * rate;
    }

    supabase.from('transactions').update(dbUpdates).eq('id', id).then(({ error }) => {
      if (error) console.error('Update transaction error:', error);
    });
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    supabase.from('transactions').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Delete transaction error:', error);
    });
  };

  const softDeleteRecurringTransaction = (id: string, fromMonthYear?: string) => {
    const monthYear = fromMonthYear || getMonthYearStr(new Date());
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, recurringEndMonth: monthYear } : t));
    supabase.from('transactions').update({ recurring_end_month: monthYear }).eq('id', id).then(({ error }) => {
      if (error) console.error(error);
    });
  };

  const toggleRecurring = (id: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id !== id) return t;
      const day = parseInt(t.date.split('-')[2]) || 1;
      const monthYear = getMonthYearStr(new Date());
      const newIsRecurring = !t.isRecurring;
      const updated = {
        ...t,
        isRecurring: newIsRecurring,
        recurrenceDay: newIsRecurring ? day : undefined,
        recurringStartMonth: newIsRecurring ? monthYear : undefined,
        recurringEndMonth: newIsRecurring ? null : undefined,
      };
      supabase.from('transactions').update({
        is_recurring: newIsRecurring,
        recurrence_day: newIsRecurring ? day : null,
        recurring_start_month: newIsRecurring ? monthYear : null,
        recurring_end_month: null,
      }).eq('id', id).then(({ error }) => { if (error) console.error(error); });
      return updated;
    }));
  };

  const deleteRecurring = (id: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, isRecurring: false, recurrenceDay: undefined, recurringStartMonth: undefined, recurringEndMonth: undefined } : t
    ));
    supabase.from('transactions').update({
      is_recurring: false, recurrence_day: null, recurring_start_month: null, recurring_end_month: null,
    }).eq('id', id).then(({ error }) => { if (error) console.error(error); });
  };

  const getRecurringTransactions = useCallback(() => {
    return transactions.filter(t => t.isRecurring && !t.recurringSourceId && !t.recurringEndMonth);
  }, [transactions]);

  // ===== Budget Actions =====
  const addBudget = (b: Omit<Budget, 'id' | 'startMonth' | 'endMonth'>) => {
    if (!householdId) return;
    const monthYear = getMonthYearStr(new Date());
    const dbRow = {
      household_id: householdId,
      category: b.category,
      emoji: b.emoji,
      limit_amount: b.limit,
      period: b.period,
      alerts_enabled: b.alertsEnabled,
      is_recurring: b.isRecurring,
      month_year: b.isRecurring ? null : (b.monthYear || monthYear),
      start_month: monthYear,
      end_month: null,
    };

    supabase.from('budgets').insert(dbRow).select().single().then(({ data, error }) => {
      if (error) { toast.error('Erreur lors de la création du budget'); console.error(error); return; }
      if (data) setBudgets(prev => [...prev, mapDbBudget(data)]);
    });
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    const dbUpdates: any = {};
    if (updates.limit !== undefined) dbUpdates.limit_amount = updates.limit;
    if (updates.isRecurring !== undefined) { dbUpdates.is_recurring = updates.isRecurring; dbUpdates.recurring = updates.isRecurring; }
    if (updates.alertsEnabled !== undefined) dbUpdates.alerts_enabled = updates.alertsEnabled;
    if (updates.endMonth !== undefined) dbUpdates.end_month = updates.endMonth;
    supabase.from('budgets').update(dbUpdates).eq('id', id).then(({ error }) => {
      if (error) console.error(error);
    });
  };

  const deleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
    supabase.from('budgets').delete().eq('id', id).then(({ error }) => {
      if (error) console.error(error);
    });
  };

  const softDeleteBudget = (id: string) => {
    const monthYear = getMonthYearStr(new Date());
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, endMonth: monthYear } : b));
    supabase.from('budgets').update({ end_month: monthYear }).eq('id', id).then(({ error }) => {
      if (error) console.error(error);
    });
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
    if (!householdId) return;
    supabase.from('savings_goals').insert({
      household_id: householdId,
      name: g.name,
      emoji: g.emoji,
      target_amount: g.target,
      currency: g.currency,
      target_date: g.targetDate || null,
    }).select().single().then(({ data, error }) => {
      if (error) { toast.error('Erreur'); console.error(error); return; }
      if (data) setSavingsGoals(prev => [...prev, mapDbSavingsGoal(data)]);
    });
  };

  const updateSavingsGoal = (id: string, updates: Partial<Omit<SavingsGoal, 'id'>>) => {
    setSavingsGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.target !== undefined) dbUpdates.target_amount = updates.target;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.targetDate !== undefined) dbUpdates.target_date = updates.targetDate || null;
    supabase.from('savings_goals').update(dbUpdates).eq('id', id).then(({ error }) => {
      if (error) console.error(error);
    });
  };

  const deleteSavingsGoal = (id: string) => {
    setSavingsGoals(prev => prev.filter(g => g.id !== id));
    setSavingsDeposits(prev => prev.filter(d => d.goalId !== id));
    supabase.from('savings_goals').delete().eq('id', id).then(({ error }) => {
      if (error) console.error(error);
    });
  };

  const addSavingsDeposit = (d: Omit<SavingsDeposit, 'id'>) => {
    if (!householdId) return;
    supabase.from('savings_deposits').insert({
      household_id: householdId,
      goal_id: d.goalId,
      member_id: d.memberId || session?.user?.id,
      amount: d.amount,
      date: d.date,
    }).select().single().then(({ data, error }) => {
      if (error) { toast.error('Erreur'); console.error(error); return; }
      if (data) setSavingsDeposits(prev => [...prev, mapDbSavingsDeposit(data)]);
    });
  };

  const deleteSavingsDeposit = (id: string) => {
    setSavingsDeposits(prev => prev.filter(d => d.id !== id));
    supabase.from('savings_deposits').delete().eq('id', id).then(({ error }) => {
      if (error) console.error(error);
    });
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
    if (!householdId) return;
    supabase.from('categories').insert({
      household_id: householdId,
      name: c.name,
      emoji: c.emoji,
      type: c.type,
      is_default: false,
    }).select().single().then(({ data, error }) => {
      if (error) { toast.error('Erreur'); console.error(error); return; }
      if (data) setDbCategories(prev => [...prev, data]);
    });
  };

  const deleteCustomCategory = (name: string) => {
    const cat = dbCategories.find((c: any) => c.name === name && !c.is_default);
    if (!cat) return;
    setDbCategories(prev => prev.filter((c: any) => c.id !== cat.id));
    supabase.from('categories').delete().eq('id', cat.id).then(({ error }) => {
      if (error) console.error(error);
    });
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
    if (!householdId) return;
    const newTransactions = transactions.map(t => {
      const rate = getExchangeRate(t.currency, currency);
      return { ...t, exchangeRate: rate, baseCurrency: currency, convertedAmount: t.amount * rate };
    });
    setTransactions(newTransactions);
    setHouseholdData(prev => prev ? { ...prev, default_currency: currency } : prev);
    supabase.from('households').update({ default_currency: currency }).eq('id', householdId).then(({ error }) => {
      if (error) console.error(error);
    });
  };

  const addMember = (name: string, email: string, role: 'admin' | 'member') => {
    if (!householdId) return;
    // Create invitation
    supabase.from('invitations').insert({
      household_id: householdId,
      email,
      role,
      invited_by: session?.user?.id,
    }).then(({ error }) => {
      if (error) { toast.error('Erreur lors de l\'invitation'); console.error(error); return; }
      toast.success(`Invitation envoyée à ${email}`);
    });
    // Add optimistically to members list for UI compatibility
    const tempMember: Member = { id: `temp-${Date.now()}`, name, email, role };
    setMembers(prev => [...prev, tempMember]);
  };

  const removeMember = (id: string) => {
    if (id.startsWith('temp-')) {
      setMembers(prev => prev.filter(m => m.id !== id));
      return;
    }
    setMembers(prev => prev.filter(m => m.id !== id));
    supabase.from('household_members').delete().eq('user_id', id).eq('household_id', householdId!).then(({ error }) => {
      if (error) console.error(error);
    });
  };

  const updateMemberRole = (id: string, role: 'admin' | 'member') => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
    if (!id.startsWith('temp-')) {
      supabase.from('household_members').update({ role }).eq('user_id', id).eq('household_id', householdId!).then(({ error }) => {
        if (error) console.error(error);
      });
    }
  };

  const resetDemo = () => {
    toast.info('Réinitialisation non disponible en mode connecté');
  };

  // ===== Account Actions =====
  const addAccount = (a: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>) => {
    if (!householdId) return;
    supabase.from('accounts').insert({
      household_id: householdId,
      name: a.name,
      type: a.type,
      currency: a.currency,
      starting_balance: a.startingBalance,
      starting_date: a.startingDate,
      is_archived: false,
    }).select().single().then(({ data, error }) => {
      if (error) { toast.error('Erreur lors de la création du compte'); console.error(error); return; }
      if (data) setAccounts(prev => [...prev, mapDbAccount(data)]);
    });
  };

  const updateAccount = (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.startingBalance !== undefined) dbUpdates.starting_balance = updates.startingBalance;
    if (updates.startingDate !== undefined) dbUpdates.starting_date = updates.startingDate;
    if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
    supabase.from('accounts').update(dbUpdates).eq('id', id).then(({ error }) => {
      if (error) console.error(error);
    });
  };

  const archiveAccount = (id: string) => {
    updateAccount(id, { isArchived: true });
  };

  const deleteAccount = (id: string): boolean => {
    const hasTransactions = transactions.some(t => t.accountId === id);
    if (hasTransactions) return false;
    setAccounts(prev => prev.filter(a => a.id !== id));
    supabase.from('accounts').delete().eq('id', id).then(({ error }) => {
      if (error) console.error(error);
    });
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
