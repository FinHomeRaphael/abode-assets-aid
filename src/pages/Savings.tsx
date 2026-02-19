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
import PaywallModal from '@/components/PaywallModal';
import PremiumModal from '@/components/PremiumModal';
import { useSubscription, FREEMIUM_LIMITS } from '@/hooks/useSubscription';

const Savings = () => {
  const {
    savingsGoals, savingsDeposits, getGoalSaved, getGoalDeposits, getMonthSavings, getTotalSavings,
    addSavingsGoal, updateSavingsGoal, deleteSavingsGoal,
    addSavingsDeposit, deleteSavingsDeposit, household, getMemberById,
    accounts, getActiveAccounts, getAccountBalance, addAccount, householdId, currentUser,
  } = useApp();
  const { formatAmount } = useCurrency();
  const { isPremium, canAdd, presentOffering } = useSubscription(householdId, currentUser?.id);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(() => searchParams.get('create') === 'account');

  // Clear query param after opening
  React.useEffect(() => {
    if (searchParams.get('create') === 'account') {
      setShowCreateAccount(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Create goal state
  const [goalName, setGoalName] = useState('');
  const [goalEmoji, setGoalEmoji] = useState('🎯');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalCurrency, setGoalCurrency] = useState(household.currency);

  // Deposit state
  const [depositGoalId, setDepositGoalId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMemberId, setDepositMemberId] = useState(household.members[0]?.id || '');
  const [depositDate, setDepositDate] = useState(formatLocalDate(new Date()));

  // Edit goal state
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCurrency, setEditCurrency] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Create account state
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('courant');
  const [accCurrency, setAccCurrency] = useState(household.currency);
  const [accBalance, setAccBalance] = useState('');
  const [accDate, setAccDate] = useState(formatLocalDate(new Date()));

  const monthSavings = getMonthSavings(currentMonth);
  const totalSavings = getTotalSavings();
  const activeAccounts = getActiveAccounts();

  // Compute total balance across all active accounts (converted to household currency)
  const totalAccountsBalance = activeAccounts.reduce((sum, acc) => {
    const bal = getAccountBalance(acc.id);
    // Simple: if same currency, add directly. Otherwise just add (for now we keep native amounts)
    return sum + bal;
  }, 0);

  const handleCreateGoal = () => {
    if (!goalName.trim() || !goalTarget) { toast.error('Remplissez les champs obligatoires'); return; }
    addSavingsGoal({ name: goalName.trim(), emoji: goalEmoji, target: parseFloat(goalTarget), currency: goalCurrency, targetDate: goalDate || undefined });
    toast.success('Objectif créé ✓');
    setShowCreateGoal(false);
    setGoalName(''); setGoalTarget(''); setGoalDate('');
    setGoalCurrency(household.currency);
  };

  const handleAddDeposit = () => {
    if (!depositGoalId || !depositAmount) { toast.error('Remplissez les champs obligatoires'); return; }
    addSavingsDeposit({ goalId: depositGoalId, amount: parseFloat(depositAmount), memberId: depositMemberId, date: depositDate });
    toast.success('Versement ajouté ✓');
    setShowAddDeposit(false);
    setDepositAmount('');
  };

  const openEditGoal = (g: SavingsGoal) => {
    setEditGoal(g);
    setEditName(g.name);
    setEditEmoji(g.emoji);
    setEditTarget(String(g.target));
    setEditDate(g.targetDate || '');
    setEditCurrency(g.currency);
    setShowDeleteConfirm(false);
  };

  const handleSaveEdit = () => {
    if (!editGoal || !editName.trim() || !editTarget) return;
    updateSavingsGoal(editGoal.id, {
      name: editName.trim(),
      emoji: editEmoji,
      target: parseFloat(editTarget),
      currency: editCurrency,
      targetDate: editDate || undefined,
    });
    toast.success('Objectif modifié ✓');
    setEditGoal(null);
  };

  const handleDeleteGoal = () => {
    if (!editGoal) return;
    deleteSavingsGoal(editGoal.id);
    toast.success('Objectif supprimé');
    setEditGoal(null);
  };

  const handleCreateAccount = () => {
    if (!accName.trim()) { toast.error('Donnez un nom au compte'); return; }
    addAccount({
      name: accName.trim(),
      type: accType,
      currency: accCurrency,
      startingBalance: parseFloat(accBalance) || 0,
      startingDate: accDate,
    });
    toast.success('Compte créé ✓');
    setShowCreateAccount(false);
    setAccName(''); setAccBalance(''); setAccDate(formatLocalDate(new Date()));
    setAccCurrency(household.currency);
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Enveloppes</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowAddDeposit(true)} className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">+ Verser</button>
            <button onClick={() => {
              if (!canAdd('savingsGoals', savingsGoals.length)) {
                setShowPaywall(true);
                return;
              }
              setShowCreateGoal(true);
            }} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
              + Objectif {!isPremium && <span className="text-xs opacity-70">({savingsGoals.length}/{FREEMIUM_LIMITS.savingsGoals})</span>}
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

        {/* ===== SECTION 1: Comptes et soldes ===== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Comptes et soldes</h2>
            <button onClick={() => setShowCreateAccount(true)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors font-medium">+ Nouveau compte</button>
          </div>

          {/* Total global */}
          <div className="card-elevated p-4 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Total tous comptes</p>
            <p className={`text-xl font-bold font-mono-amount ${totalAccountsBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatAmount(totalAccountsBalance)}
            </p>
          </div>

          {activeAccounts.length === 0 ? (
            <div className="card-elevated p-6 text-center text-muted-foreground text-sm">
              Aucun compte créé.
              <button onClick={() => setShowCreateAccount(true)} className="block mx-auto mt-2 text-primary underline text-xs">Créer mon premier compte</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {activeAccounts.map(acc => {
                const bal = getAccountBalance(acc.id);
                const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type);
                return (
                  <div key={acc.id} onClick={() => navigate(`/account/${acc.id}`)} className="card-elevated p-4 card-hover cursor-pointer active:scale-[0.98] transition-transform">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{typeInfo?.emoji} {acc.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-muted text-muted-foreground font-medium">{acc.currency}</span>
                    </div>
                    <p className={`font-mono-amount font-bold ${bal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatAmount(bal, acc.currency)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">{typeInfo?.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== SECTION 2: Objectifs d'enveloppe ===== */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Objectifs d'enveloppe</h2>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card-elevated p-4 text-center card-hover">
              <p className="text-xs text-muted-foreground mb-0.5">Ce mois</p>
              <p className="font-mono-amount font-bold text-primary">{formatAmount(monthSavings)}</p>
            </div>
            <div className="card-elevated p-4 text-center card-hover">
              <p className="text-xs text-muted-foreground mb-0.5">Total cumulé</p>
              <p className="font-mono-amount font-bold">{formatAmount(totalSavings)}</p>
            </div>
            <div className="card-elevated p-4 text-center card-hover">
              <p className="text-xs text-muted-foreground mb-0.5">Objectifs</p>
              <p className="font-mono-amount font-bold">{savingsGoals.length}</p>
            </div>
          </div>

          {/* Goals */}
          {savingsGoals.length === 0 ? (
            <div className="card-elevated p-8 text-center text-muted-foreground text-sm">Aucun objectif d'enveloppe créé</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {savingsGoals.map(g => {
                const saved = getGoalSaved(g.id);
                const pct = Math.min((saved / g.target) * 100, 100);
                return (
                  <div key={g.id} onClick={() => openEditGoal(g)} className="card-elevated p-5 card-hover cursor-pointer active:scale-[0.98] transition-transform">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-lg">{g.emoji} {g.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-muted text-muted-foreground font-medium">{g.currency}</span>
                        <span className="text-sm font-mono-amount font-bold text-primary">{Math.round(pct)}%</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className="h-full rounded-full bg-primary" />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono-amount text-muted-foreground">{formatAmount(saved, g.currency)} / {formatAmount(g.target, g.currency)}</span>
                      {g.targetDate && <span className="text-xs text-muted-foreground">{formatDateLong(g.targetDate)}</span>}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditGoal(null)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-1">{editEmoji} {editName || 'Objectif'}</h2>

                {(() => {
                  const saved = getGoalSaved(editGoal.id);
                  const target = parseFloat(editTarget) || editGoal.target;
                  const pct = Math.min((saved / target) * 100, 100);
                  const deposits = getGoalDeposits(editGoal.id);
                  return (
                    <div className="mb-5">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-muted-foreground font-mono-amount">{formatAmount(saved, editCurrency)} / {formatAmount(target, editCurrency)}</span>
                        <span className="font-bold text-primary">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden mb-3">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      {editGoal.targetDate && (() => {
                        const remaining = Math.ceil((new Date(editGoal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
                        return <p className="text-xs text-muted-foreground">{remaining > 0 ? `Objectif dans ${remaining} mois` : 'Date cible dépassée'}</p>;
                      })()}

                      {deposits.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Versements ({deposits.length})</p>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {deposits.sort((a, b) => b.date.localeCompare(a.date)).map(d => {
                              const member = getMemberById(d.memberId);
                              return (
                                <div key={d.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{formatDateLong(d.date)}</span>
                                    {member && <span className="text-muted-foreground">• {member.name}</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono-amount font-medium text-primary">+{formatAmount(d.amount, editCurrency)}</span>
                                    <button onClick={() => { deleteSavingsDeposit(d.id); toast.success('Versement supprimé'); }} className="text-destructive hover:text-destructive/80 text-[10px] font-medium">✕</button>
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

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nom</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Emoji</label>
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 bg-muted/50 rounded-xl">
                      {EMOJI_LIST.map(e => (
                        <button key={e} onClick={() => setEditEmoji(e)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${editEmoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted'}`}>{e}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Montant cible</label>
                      <input type="number" value={editTarget} onChange={e => setEditTarget(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Devise</label>
                      <select value={editCurrency} onChange={e => setEditCurrency(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} {c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date cible (optionnel)</label>
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex gap-3">
                    <button onClick={() => setEditGoal(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                    <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Sauvegarder</button>
                  </div>
                  {!showDeleteConfirm ? (
                    <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-2.5 rounded-xl border border-destructive text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors">
                      Supprimer cet objectif
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl border border-destructive bg-destructive/5 space-y-2">
                      <p className="text-sm text-destructive font-medium text-center">Supprimer définitivement ? Tous les versements associés seront perdus.</p>
                      <div className="flex gap-3">
                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors">Non</button>
                        <button onClick={handleDeleteGoal} className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors">Oui, supprimer</button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Goal Modal */}
        <AnimatePresence>
          {showCreateGoal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreateGoal(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6">
                <h2 className="text-lg font-bold mb-5">Créer un objectif</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nom</label>
                    <input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="Ex: Vacances" className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Emoji</label>
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 bg-muted/50 rounded-xl">
                      {EMOJI_LIST.map(e => (
                        <button key={e} onClick={() => setGoalEmoji(e)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${goalEmoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted'}`}>{e}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Montant cible</label>
                      <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="5000" className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Devise</label>
                      <select value={goalCurrency} onChange={e => setGoalCurrency(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} {c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date cible (optionnel)</label>
                    <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowCreateGoal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                  <button onClick={handleCreateGoal} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Créer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Deposit Modal */}
        <AnimatePresence>
          {showAddDeposit && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddDeposit(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6">
                <h2 className="text-lg font-bold mb-5">Ajouter un versement</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Objectif</label>
                    <select value={depositGoalId} onChange={e => setDepositGoalId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm">
                      <option value="">Sélectionner...</option>
                      {savingsGoals.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name} ({g.currency})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Montant</label>
                    <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="100" className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date</label>
                    <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Membre</label>
                    <div className="flex gap-2">
                      {household.members.map(m => (
                        <button key={m.id} onClick={() => setDepositMemberId(m.id)} className={`px-3 py-2 rounded-xl border text-sm transition-all ${depositMemberId === m.id ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>{m.name}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowAddDeposit(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                  <button onClick={handleAddDeposit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Enregistrer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Account Modal */}
        <AnimatePresence>
          {showCreateAccount && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreateAccount(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6">
                <h2 className="text-lg font-bold mb-5">Nouveau compte</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nom du compte *</label>
                    <input value={accName} onChange={e => setAccName(e.target.value)} placeholder="Ex: Compte salaire UBS" className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Type</label>
                    <select value={accType} onChange={e => setAccType(e.target.value as AccountType)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Devise</label>
                    <select value={accCurrency} onChange={e => setAccCurrency(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Solde de base</label>
                    <input type="number" step="0.01" value={accBalance} onChange={e => setAccBalance(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="overflow-hidden">
                    <label className="block text-sm font-medium mb-1.5">Date de base</label>
                    <input type="date" value={accDate} onChange={e => setAccDate(e.target.value)} className="w-full max-w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring box-border overflow-hidden appearance-none" style={{ WebkitAppearance: 'none' }} />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowCreateAccount(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                  <button onClick={handleCreateAccount} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Créer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} onUpgrade={() => { setShowPaywall(false); setShowPremium(true); }} feature="objectif(s) d'enveloppe" limit={FREEMIUM_LIMITS.savingsGoals} icon="🎯" />
      <PremiumModal open={showPremium} onClose={() => setShowPremium(false)} presentOffering={presentOffering} />
    </Layout>
  );
};

export default Savings;
