import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatAmount, formatDateLong } from '@/utils/format';
import { EMOJI_LIST } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';

const Savings = () => {
  const { savingsGoals, savingsDeposits, getGoalSaved, getMonthSavings, getTotalSavings, addSavingsGoal, addSavingsDeposit, household } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showAddDeposit, setShowAddDeposit] = useState(false);

  const [goalName, setGoalName] = useState('');
  const [goalEmoji, setGoalEmoji] = useState('🎯');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDate, setGoalDate] = useState('');

  const [depositGoalId, setDepositGoalId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMemberId, setDepositMemberId] = useState(household.members[0]?.id || '');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);

  const monthSavings = getMonthSavings(currentMonth);
  const totalSavings = getTotalSavings();

  const handleCreateGoal = () => {
    if (!goalName.trim() || !goalTarget) { toast.error('Remplissez les champs obligatoires'); return; }
    addSavingsGoal({ name: goalName.trim(), emoji: goalEmoji, target: parseFloat(goalTarget), targetDate: goalDate || undefined });
    toast.success('Objectif créé ✓');
    setShowCreateGoal(false);
    setGoalName(''); setGoalTarget(''); setGoalDate('');
  };

  const handleAddDeposit = () => {
    if (!depositGoalId || !depositAmount) { toast.error('Remplissez les champs obligatoires'); return; }
    addSavingsDeposit({ goalId: depositGoalId, amount: parseFloat(depositAmount), memberId: depositMemberId, date: depositDate });
    toast.success('Épargne ajoutée ✓');
    setShowAddDeposit(false);
    setDepositAmount('');
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Épargne</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowAddDeposit(true)} className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">+ Épargner</button>
            <button onClick={() => setShowCreateGoal(true)} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">+ Objectif</button>
          </div>
        </div>

        <div className="flex justify-center">
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

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
          <div className="card-elevated p-8 text-center text-muted-foreground text-sm">Aucun objectif d'épargne créé</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {savingsGoals.map(g => {
              const saved = getGoalSaved(g.id);
              const pct = Math.min((saved / g.target) * 100, 100);
              return (
                <div key={g.id} className="card-elevated p-5 card-hover">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-lg">{g.emoji} {g.name}</span>
                    <span className="text-sm font-mono-amount font-bold text-primary">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className="h-full rounded-full bg-primary" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono-amount text-muted-foreground">{formatAmount(saved)} / {formatAmount(g.target)}</span>
                    {g.targetDate && <span className="text-xs text-muted-foreground">{formatDateLong(g.targetDate)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Montant cible</label>
                    <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="5000" className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
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
                <h2 className="text-lg font-bold mb-5">Ajouter de l'épargne</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Objectif</label>
                    <select value={depositGoalId} onChange={e => setDepositGoalId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm">
                      <option value="">Sélectionner...</option>
                      {savingsGoals.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
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
      </motion.div>
    </Layout>
  );
};

export default Savings;
