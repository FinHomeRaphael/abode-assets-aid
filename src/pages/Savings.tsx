import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { formatDateLong, formatLocalDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { EMOJI_LIST, CURRENCIES, CURRENCY_SYMBOLS, ACCOUNT_TYPES, SavingsGoal, AccountType } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PremiumPaywall';
import { PiggyBank, Wallet, Target, Plus, X, Trash2 } from 'lucide-react';

const SectionTitle = ({ icon: Icon, title, action, onAction }: { icon: React.ElementType; title: string; action?: string; onAction?: () => void }) => (
  <div className="flex items-center justify-between mb-2">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h2 className="font-semibold text-sm">{title}</h2>
    </div>
    {action && onAction && (
      <button onClick={onAction} className="text-[11px] px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors font-medium">{action}</button>
    )}
  </div>
);

const Savings = () => {
  const {
    scopedSavingsGoals: savingsGoals, savingsDeposits, getGoalSaved, getGoalDeposits, getMonthSavings, getTotalSavings,
    addSavingsGoal, updateSavingsGoal, deleteSavingsGoal,
    addSavingsDeposit, deleteSavingsDeposit, household, getMemberById,
    scopedAccounts: accounts, getActiveAccounts, getAccountBalance, addAccount, householdId, currentUser,
  } = useApp();
  const { formatAmount } = useCurrency();
  const { canAdd } = useSubscription(householdId, currentUser?.id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(() => searchParams.get('create') === 'account');
  const [showPaywall, setShowPaywall] = useState(false);
  React.useEffect(() => {
    if (searchParams.get('create') === 'account') {
      setShowCreateAccount(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [goalName, setGoalName] = useState('');
  const [goalEmoji, setGoalEmoji] = useState('🎯');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalCurrency, setGoalCurrency] = useState(household.currency);

  const [depositGoalId, setDepositGoalId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMemberId, setDepositMemberId] = useState(household.members[0]?.id || '');
  const [depositDate, setDepositDate] = useState(formatLocalDate(new Date()));

  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCurrency, setEditCurrency] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('courant');
  const [accCurrency, setAccCurrency] = useState(household.currency);
  const [accBalance, setAccBalance] = useState('');
  const [accDate, setAccDate] = useState(formatLocalDate(new Date()));

  const monthSavings = getMonthSavings(currentMonth);
  const totalSavings = getTotalSavings();
  const activeAccounts = getActiveAccounts();
  const totalAccountsBalance = activeAccounts.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);

  const handleCreateGoal = () => {
    if (!goalName.trim() || !goalTarget) { toast.error('Remplissez les champs obligatoires'); return; }
    addSavingsGoal({ name: goalName.trim(), emoji: goalEmoji, target: parseFloat(goalTarget), currency: goalCurrency, targetDate: goalDate || undefined });
    toast.success('Objectif créé ✓');
    setShowCreateGoal(false); setGoalName(''); setGoalTarget(''); setGoalDate(''); setGoalCurrency(household.currency);
  };

  const handleAddDeposit = () => {
    if (!depositGoalId || !depositAmount) { toast.error('Remplissez les champs obligatoires'); return; }
    addSavingsDeposit({ goalId: depositGoalId, amount: parseFloat(depositAmount), memberId: depositMemberId, date: depositDate });
    toast.success('Versement ajouté ✓');
    setShowAddDeposit(false); setDepositAmount('');
  };

  const openEditGoal = (g: SavingsGoal) => {
    setEditGoal(g); setEditName(g.name); setEditEmoji(g.emoji); setEditTarget(String(g.target)); setEditDate(g.targetDate || ''); setEditCurrency(g.currency); setShowDeleteConfirm(false);
  };

  const handleSaveEdit = () => {
    if (!editGoal || !editName.trim() || !editTarget) return;
    updateSavingsGoal(editGoal.id, { name: editName.trim(), emoji: editEmoji, target: parseFloat(editTarget), currency: editCurrency, targetDate: editDate || undefined });
    toast.success('Objectif modifié ✓'); setEditGoal(null);
  };

  const handleDeleteGoal = () => { if (!editGoal) return; deleteSavingsGoal(editGoal.id); toast.success('Objectif supprimé'); setEditGoal(null); };

  const handleCreateAccount = () => {
    if (!accName.trim()) { toast.error('Donnez un nom au compte'); return; }
    addAccount({ name: accName.trim(), type: accType, currency: accCurrency, startingBalance: parseFloat(accBalance) || 0, startingDate: accDate });
    toast.success('Compte créé ✓');
    setShowCreateAccount(false); setAccName(''); setAccBalance(''); setAccDate(formatLocalDate(new Date())); setAccCurrency(household.currency);
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
          <h1 className="text-xl font-bold">Enveloppes</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowAddDeposit(true)} className="h-9 px-3 rounded-xl border border-border/30 bg-secondary/30 text-sm font-medium hover:bg-secondary/50 transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Verser
            </button>
            <button onClick={() => {
              if (!canAdd('savingsGoals', savingsGoals.length)) {
                setShowPaywall(true);
                return;
              }
              setShowCreateGoal(true);
            }} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Objectif
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

        {/* Comptes */}
        <div>
          <SectionTitle icon={Wallet} title="Comptes bancaires" action="+ Nouveau" onAction={() => {
            if (!canAdd('accounts', accounts.length)) {
              setShowPaywall(true);
              return;
            }
            setShowCreateAccount(true);
          }} />

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
                const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type);
                return (
                  <div key={acc.id} onClick={() => navigate(`/account/${acc.id}`)} className="bg-card border border-border rounded-xl p-3.5 cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{typeInfo?.emoji} {acc.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-secondary/50 text-muted-foreground font-medium">{acc.currency}</span>
                    </div>
                    <p className={`font-mono-amount font-bold ${bal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatAmount(bal, acc.currency)}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1">{typeInfo?.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Objectifs */}
        <div>
          <SectionTitle icon={PiggyBank} title="Objectifs d'enveloppe" />

            <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">Ce mois</p>
              <p className="font-mono-amount font-semibold text-primary text-sm">{formatAmount(monthSavings)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">Total cumulé</p>
              <p className="font-mono-amount font-semibold text-sm">{formatAmount(totalSavings)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">Objectifs</p>
              <p className="font-mono-amount font-semibold text-sm">{savingsGoals.length}</p>
            </div>
          </div>

          {savingsGoals.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">Aucun objectif créé</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {savingsGoals.map(g => {
                const saved = getGoalSaved(g.id);
                const pct = Math.min((saved / g.target) * 100, 100);
                return (
                  <div key={g.id} onClick={() => openEditGoal(g)} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-base">{g.emoji} {g.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-secondary/50 text-muted-foreground font-medium">{g.currency}</span>
                        <span className={`font-mono-amount text-xs font-bold ${pct >= 100 ? 'text-success' : 'text-primary'}`}>{Math.round(pct)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${pct >= 100 ? 'bg-success' : 'bg-primary'}`} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-amount text-muted-foreground">{formatAmount(saved, g.currency)} / {formatAmount(g.target, g.currency)}</span>
                      {g.targetDate && <span className="text-[10px] text-muted-foreground">{formatDateLong(g.targetDate)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Edit Goal Modal */}
        <AnimatePresence>
          {editGoal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={modalOverlay} onClick={() => setEditGoal(null)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className={`${modalCard} max-h-[90vh] overflow-y-auto`}>
                <div className={modalHeader}>
                  <h2 className="text-base font-bold">{editEmoji} {editName || 'Objectif'}</h2>
                  <button onClick={() => setEditGoal(null)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-5">
                  {(() => {
                    const saved = getGoalSaved(editGoal.id);
                    const target = parseFloat(editTarget) || editGoal.target;
                    const pct = Math.min((saved / target) * 100, 100);
                    const deposits = getGoalDeposits(editGoal.id);
                    return (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground font-mono-amount">{formatAmount(saved, editCurrency)} / {formatAmount(target, editCurrency)}</span>
                          <span className={`font-bold ${pct >= 100 ? 'text-success' : 'text-primary'}`}>{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                          <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                        </div>
                        {editGoal.targetDate && (() => {
                          const remaining = Math.ceil((new Date(editGoal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
                          return <p className="text-[10px] text-muted-foreground">{remaining > 0 ? `${remaining} mois restants` : 'Date cible dépassée'}</p>;
                        })()}
                        {deposits.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-[10px] font-medium text-muted-foreground">Versements ({deposits.length})</p>
                            <div className="max-h-28 overflow-y-auto space-y-1">
                              {deposits.sort((a, b) => b.date.localeCompare(a.date)).map(d => {
                                const member = getMemberById(d.memberId);
                                return (
                                  <div key={d.id} className="flex items-center justify-between text-[11px] bg-secondary/30 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">{formatDateLong(d.date)}</span>
                                      {member && <span className="text-muted-foreground">· {member.name}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono-amount font-medium text-primary">+{formatAmount(d.amount, editCurrency)}</span>
                                      <button onClick={() => { deleteSavingsDeposit(d.id); toast.success('Supprimé'); }} className="text-destructive hover:text-destructive/80 text-[10px]">✕</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium mb-1">Nom</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Emoji</label>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 bg-secondary/30 rounded-xl border border-border/30">
                        {EMOJI_LIST.map(e => (
                          <button key={e} onClick={() => setEditEmoji(e)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${editEmoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-secondary/50'}`}>{e}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Cible</label>
                        <input type="number" value={editTarget} onChange={e => setEditTarget(e.target.value)} className={`${inputClass} font-mono-amount`} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Devise</label>
                        <select value={editCurrency} onChange={e => setEditCurrency(e.target.value)} className={inputClass}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} {c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Date cible (optionnel)</label>
                      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={inputClass} />
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex gap-2">
                      <button onClick={() => setEditGoal(null)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                      <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Sauvegarder</button>
                    </div>
                    {!showDeleteConfirm ? (
                      <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-2.5 rounded-xl bg-destructive/5 border border-destructive/15 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors flex items-center justify-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Supprimer
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/5 space-y-2">
                        <p className="text-xs text-destructive font-medium text-center">Supprimer définitivement ?</p>
                        <div className="flex gap-2">
                          <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 rounded-xl border border-border/30 text-sm hover:bg-secondary/30 transition-colors">Non</button>
                          <button onClick={handleDeleteGoal} className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors">Oui</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Goal Modal */}
        <AnimatePresence>
          {showCreateGoal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={modalOverlay} onClick={() => setShowCreateGoal(false)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className={modalCard}>
                <div className={modalHeader}>
                  <h2 className="text-base font-bold">Créer un objectif</h2>
                  <button onClick={() => setShowCreateGoal(false)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium mb-1">Nom</label>
                    <input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="Ex: Vacances" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Emoji</label>
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 bg-secondary/30 rounded-xl border border-border/30">
                      {EMOJI_LIST.map(e => (
                        <button key={e} onClick={() => setGoalEmoji(e)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${goalEmoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-secondary/50'}`}>{e}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Cible</label>
                      <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="5000" className={`${inputClass} font-mono-amount`} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Devise</label>
                      <select value={goalCurrency} onChange={e => setGoalCurrency(e.target.value)} className={inputClass}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} {c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Date cible (optionnel)</label>
                    <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="px-5 pb-5 flex gap-2">
                  <button onClick={() => setShowCreateGoal(false)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                  <button onClick={handleCreateGoal} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Créer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Deposit Modal */}
        <AnimatePresence>
          {showAddDeposit && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={modalOverlay} onClick={() => setShowAddDeposit(false)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className={modalCard}>
                <div className={modalHeader}>
                  <h2 className="text-base font-bold">Ajouter un versement</h2>
                  <button onClick={() => setShowAddDeposit(false)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium mb-1">Objectif</label>
                    <select value={depositGoalId} onChange={e => setDepositGoalId(e.target.value)} className={inputClass}>
                      <option value="">Sélectionner...</option>
                      {savingsGoals.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name} ({g.currency})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Montant</label>
                    <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="100" className={`${inputClass} font-mono-amount`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Date</label>
                    <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Membre</label>
                    <div className="flex gap-2">
                      {household.members.map(m => (
                        <button key={m.id} onClick={() => setDepositMemberId(m.id)} className={`px-3 py-2 rounded-xl border text-sm transition-all ${depositMemberId === m.id ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}>{m.name}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-5 pb-5 flex gap-2">
                  <button onClick={() => setShowAddDeposit(false)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                  <button onClick={handleAddDeposit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Enregistrer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    <select value={accType} onChange={e => setAccType(e.target.value as AccountType)} className={inputClass}>
                      {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                    </select>
                  </div>
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
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} feature="les enveloppes illimitées" description="Vous avez atteint la limite gratuite. Passez à Premium pour créer des comptes et objectifs illimités." />
    </Layout>
  );
};

export default Savings;
