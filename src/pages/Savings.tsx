import React, { useState } from 'react';
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
import { Wallet, X, Plus } from 'lucide-react';

const SectionTitle = ({ icon: Icon, title, actions }: { icon: React.ElementType; title: string; actions?: { label: string; onClick: () => void }[] }) => (
  <div className="flex items-center justify-between mb-2">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h2 className="font-semibold text-sm">{title}</h2>
    </div>
    {actions && actions.length > 0 && (
      <div className="flex items-center gap-1.5">
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} className="text-[11px] px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors font-medium">{a.label}</button>
        ))}
      </div>
    )}
  </div>
);

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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative space-y-5">
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Épargne</h1>
        </div>

        <div className="flex justify-center">
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

        {/* Résumé épargne */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Épargne ce mois</p>
            <p className={`font-mono-amount font-semibold text-sm ${monthSavings >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatAmount(monthSavings)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Total épargne</p>
            <p className="font-mono-amount font-semibold text-sm">{formatAmount(totalSavings)}</p>
          </div>
        </div>

        {/* Comptes */}
        <div>
          <SectionTitle icon={Wallet} title="Comptes bancaires" actions={[{
            label: '+ Nouveau',
            onClick: () => {
              if (!canAdd('accounts', accounts.length)) { setShowPaywall(true); return; }
              setShowCreateAccount(true);
            }
          }]} />

          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-4 text-center mb-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_70%)]" />
            <div className="relative">
              <p className="text-[10px] text-muted-foreground mb-1">Total tous comptes</p>
              <p className={`text-xl font-bold font-mono-amount ${totalAccountsBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                {formatAmount(totalAccountsBalance)}
              </p>
            </div>
          </div>

          {activeAccounts.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
              Aucun compte créé.
              <button onClick={() => setShowCreateAccount(true)} className="block mx-auto mt-2 text-primary underline text-xs">Créer mon premier compte</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {activeAccounts.map(acc => {
                const bal = getAccountBalance(acc.id);
                const typeInfo = allAccountTypes.find(t => t.value === acc.type);
                return (
                  <div key={acc.id} onClick={() => navigate(`/account/${acc.id}`)} className="bg-card border border-border rounded-xl p-3.5 cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{typeInfo?.emoji} {acc.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-secondary/50 text-muted-foreground font-medium">{acc.currency}</span>
                    </div>
                    <p className={`font-mono-amount font-bold ${bal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatAmount(bal, acc.currency)}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1">{typeInfo?.label || acc.type}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
