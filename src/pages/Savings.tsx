import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { formatLocalDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES, CURRENCY_SYMBOLS, ACCOUNT_TYPES, AccountType } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PremiumPaywall';
import { Wallet, X, Plus, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Landmark, PiggyBank, CreditCard, ChevronRight } from 'lucide-react';
import { AccountIcon } from '@/utils/categoryIcons';

const Savings = () => {
  const {
    getMonthSavings, getTotalSavings,
    household,
    accounts, getAccountBalance, addAccount, householdId, currentUser,
    customAccountTypes, addCustomAccountType,
  } = useApp();
  const { formatAmount } = useCurrency();
  const { canAdd } = useSubscription(householdId, currentUser?.id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateAccount, setShowCreateAccount] = useState(() => searchParams.get('create') === 'account');
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAccountBreakdown, setShowAccountBreakdown] = useState(false);

  React.useEffect(() => {
    if (searchParams.get('create') === 'account') {
      setShowCreateAccount(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('courant');
  const [accCurrency, setAccCurrency] = useState(household.currency);
  const [accBalance, setAccBalance] = useState('');
  const [accDate, setAccDate] = useState(formatLocalDate(new Date()));

  // Custom account type creation
  const [showCreateType, setShowCreateType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeEmoji, setNewTypeEmoji] = useState('🏦');

  const allAccountTypes = [...ACCOUNT_TYPES, ...customAccountTypes.map(t => ({ value: t.value, label: t.label, emoji: t.emoji }))];

  const monthSavings = getMonthSavings(currentMonth);
  const totalSavings = getTotalSavings();
  const activeAccounts = accounts.filter(acc => !acc.isArchived);
  const totalAccountsBalance = activeAccounts.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);

  // Group accounts by type
  const accountsByType = useMemo(() => {
    const groups: Record<string, typeof activeAccounts> = {};
    activeAccounts.forEach(acc => {
      const typeInfo = allAccountTypes.find(t => t.value === acc.type);
      const label = typeInfo?.label || acc.type;
      if (!groups[label]) groups[label] = [];
      groups[label].push(acc);
    });
    return groups;
  }, [activeAccounts, allAccountTypes]);

  // Positive vs negative balance
  const positiveBalance = activeAccounts.reduce((sum, acc) => {
    const bal = getAccountBalance(acc.id);
    return bal > 0 ? sum + bal : sum;
  }, 0);
  const negativeBalance = activeAccounts.reduce((sum, acc) => {
    const bal = getAccountBalance(acc.id);
    return bal < 0 ? sum + Math.abs(bal) : sum;
  }, 0);

  const handleCreateAccount = () => {
    if (!accName.trim()) { toast.error('Donnez un nom au compte'); return; }
    addAccount({ name: accName.trim(), type: accType, currency: accCurrency, startingBalance: parseFloat(accBalance) || 0, startingDate: accDate });
    setShowCreateAccount(false); setAccName(''); setAccBalance(''); setAccDate(formatLocalDate(new Date())); setAccCurrency(household.currency);
  };

  const handleCreateType = () => {
    const name = newTypeName.trim();
    if (!name) { toast.error('Donnez un nom au type'); return; }
    if (allAccountTypes.some(t => t.label.toLowerCase() === name.toLowerCase() || t.value.toLowerCase() === name.toLowerCase())) {
      toast.error('Ce type existe déjà'); return;
    }
    const value = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    addCustomAccountType({ value, label: name, emoji: newTypeEmoji });
    setAccType(value);
    setShowCreateType(false);
    setNewTypeName('');
    setNewTypeEmoji('🏦');
    toast.success('Type de compte créé');
  };

  const modalOverlay = "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-center justify-center p-4";
  const modalCard = "bg-card w-full max-w-md rounded-2xl border border-border/30 shadow-2xl overflow-hidden";
  const modalHeader = "px-5 pt-5 pb-3 border-b border-border/30 flex items-center justify-between";
  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Layout>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 via-transparent to-transparent h-64" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Comptes bancaires</h1>
          <button
            onClick={() => {
              if (!canAdd('accounts', accounts.length)) { setShowPaywall(true); return; }
              setShowCreateAccount(true);
            }}
            className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nouveau
          </button>
        </div>

        {/* Hero Card */}
        <div className="bg-primary rounded-2xl p-5 shadow-lg shadow-primary/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary-foreground)/0.08),transparent_70%)]" />
          <div className="relative">
            <p className="text-xs text-primary-foreground/70 mb-1">Solde total</p>
            <p className={`text-3xl font-bold font-mono-amount text-primary-foreground`}>
              {formatAmount(totalAccountsBalance)}
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-primary-foreground/60">
              <span>{activeAccounts.length} compte{activeAccounts.length > 1 ? 's' : ''} actif{activeAccounts.length > 1 ? 's' : ''}</span>
              {Object.keys(accountsByType).length > 1 && (
                <span>{Object.keys(accountsByType).length} types</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          {/* Épargne ce mois */}
          <div className="bg-card border border-border/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Épargne du mois</p>
            <p className={`font-mono-amount font-bold text-sm ${monthSavings >= 0 ? 'text-success' : 'text-destructive'}`}>
              {monthSavings >= 0 ? '+' : ''}{formatAmount(monthSavings)}
            </p>
          </div>

          {/* Total épargne */}
          <div className="bg-card border border-border/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Total épargné</p>
            <p className="font-mono-amount font-bold text-sm">{formatAmount(totalSavings)}</p>
          </div>

          {/* Actifs / Passifs */}
          <div 
            className="bg-card border border-border/40 rounded-xl p-3 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setShowAccountBreakdown(!showAccountBreakdown)}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground mb-1">Actifs</p>
              {activeAccounts.length > 0 && (
                showAccountBreakdown ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
            <p className="font-mono-amount font-bold text-sm text-success">{formatAmount(positiveBalance)}</p>
            {negativeBalance > 0 && (
              <p className="text-[9px] text-destructive font-mono-amount mt-0.5">-{formatAmount(negativeBalance)}</p>
            )}
          </div>
        </div>

        {/* Account breakdown dropdown */}
        <AnimatePresence>
          {showAccountBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden -mt-2"
            >
              <div className="bg-card border border-border/40 rounded-xl divide-y divide-border/30">
                {activeAccounts.map(acc => {
                  const bal = getAccountBalance(acc.id);
                  return (
                    <div key={acc.id} className="px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-2">
                        <AccountIcon type={acc.type} size="sm" />
                        {acc.name}
                      </span>
                      <span className={`font-mono-amount text-xs font-semibold ${bal >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatAmount(bal, acc.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Month Selector */}
        <div className="flex justify-center">
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

        {/* Accounts List */}
        {activeAccounts.length === 0 ? (
          <div className="bg-card border border-border/40 rounded-2xl p-8 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">Aucun compte créé</p>
            <button onClick={() => setShowCreateAccount(true)} className="text-primary text-sm font-medium hover:underline">
              Créer mon premier compte
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
            {activeAccounts.map(acc => {
              const bal = getAccountBalance(acc.id);
              const typeInfo = allAccountTypes.find(t => t.value === acc.type);
              return (
                <div
                  key={acc.id}
                  onClick={() => navigate(`/account/${acc.id}`)}
                  className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <AccountIcon type={acc.type} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{acc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{typeInfo?.label || acc.type}</span>
                      {acc.currency !== household.currency && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary/50 text-muted-foreground font-medium">{acc.currency}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className={`font-mono-amount font-bold text-sm ${bal >= 0 ? '' : 'text-destructive'}`}>
                      {formatAmount(bal, acc.currency)}
                    </p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Account Modal */}
        <AnimatePresence>
          {showCreateAccount && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={modalOverlay} onClick={() => setShowCreateAccount(false)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className={modalCard}>
                <div className={modalHeader}>
                  <h2 className="text-base font-bold">Nouveau compte</h2>
                  <button onClick={() => setShowCreateAccount(false)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium mb-1">Nom du compte *</label>
                    <input value={accName} onChange={e => setAccName(e.target.value)} placeholder="Ex: Compte salaire" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Type</label>
                    <div className="flex gap-2">
                      <select value={accType} onChange={e => setAccType(e.target.value as AccountType)} className={`${inputClass} flex-1`}>
                        {allAccountTypes.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCreateType(true)}
                        className="px-2.5 rounded-xl border border-border/30 bg-secondary/20 hover:bg-muted transition-colors flex items-center gap-1 text-xs text-muted-foreground shrink-0"
                        title="Créer un type personnalisé"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline custom type creation */}
                  <AnimatePresence>
                    {showCreateType && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-secondary/30 rounded-xl p-3 space-y-2 border border-border/30">
                          <p className="text-xs font-medium">Nouveau type de compte</p>
                          <div className="flex gap-2">
                            <input
                              value={newTypeEmoji}
                              onChange={e => setNewTypeEmoji(e.target.value)}
                              className="w-12 px-2 py-2 rounded-lg border border-border/30 bg-background text-center text-sm"
                              maxLength={4}
                            />
                            <input
                              value={newTypeName}
                              onChange={e => setNewTypeName(e.target.value)}
                              placeholder="Ex: Compte joint"
                              className={`${inputClass} flex-1`}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setShowCreateType(false); setNewTypeName(''); setNewTypeEmoji('🏦'); }} className="flex-1 py-2 rounded-lg border border-border/30 text-xs font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                            <button onClick={handleCreateType} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">Créer</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="block text-xs font-medium mb-1">Devise</label>
                    <select value={accCurrency} onChange={e => setAccCurrency(e.target.value)} className={inputClass}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Solde de base</label>
                    <input type="number" step="0.01" value={accBalance} onChange={e => setAccBalance(e.target.value)} placeholder="0.00" className={`${inputClass} font-mono-amount`} />
                  </div>
                  <div className="overflow-hidden">
                    <label className="block text-xs font-medium mb-1">Date de base</label>
                    <input type="date" value={accDate} onChange={e => setAccDate(e.target.value)} className={`${inputClass} box-border overflow-hidden`} style={{ WebkitAppearance: 'none' }} />
                  </div>
                </div>
                <div className="px-5 pb-5 flex gap-2">
                  <button onClick={() => setShowCreateAccount(false)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                  <button onClick={handleCreateAccount} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Créer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} feature="les comptes illimités" description="Vous avez atteint la limite gratuite. Passez à Premium pour créer des comptes illimités." />
    </Layout>
  );
};

export default Savings;
