import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateLong, formatDate } from '@/utils/format';
import { ACCOUNT_TYPES, CURRENCIES, CURRENCY_SYMBOLS } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import BackHeader from '@/components/BackHeader';
import { AccountIcon, CategoryIcon } from '@/utils/categoryIcons';
import { ArrowUpRight, ArrowDownLeft, Pencil, Archive, Trash2, TrendingUp, TrendingDown, Calendar, ChevronDown, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const AccountDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { scopedAccounts: accounts, getAccountBalance, getAccountTransactions, updateAccount, archiveAccount, deleteAccount, getMemberById, customAccountTypes } = useApp();
  const { formatAmount } = useCurrency();

  const account = accounts.find(a => a.id === id);
  const [showEdit, setShowEdit] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<string>('');
  const [editCurrency, setEditCurrency] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editDate, setEditDate] = useState('');

  const balance = account ? getAccountBalance(account.id) : 0;
  const transactions = account ? getAccountTransactions(account.id) : [];
  const allAccountTypes = [...ACCOUNT_TYPES, ...customAccountTypes.map(t => ({ value: t.value, label: t.label, emoji: t.emoji }))];
  const typeInfo = account ? allAccountTypes.find(t => t.value === account.type) : null;

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netChange = account ? balance - account.startingBalance : 0;
  const displayedTransactions = showAllTransactions ? transactions : transactions.slice(0, 10);

  const chartData = useMemo(() => {
    if (!account || transactions.length === 0) return [];
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const monthMap = new Map<string, number>();

    const startDate = new Date(account.startingDate);
    const startKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(startKey, account.startingBalance);

    let runningBalance = account.startingBalance;
    for (const t of sorted) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      runningBalance += t.type === 'income' ? t.amount : -t.amount;
      monthMap.set(key, runningBalance);
    }

    const keys = Array.from(monthMap.keys()).sort();
    if (keys.length === 0) return [];

    const result: { month: string; solde: number }[] = [];
    const first = keys[0];
    const last = keys[keys.length - 1];
    let [y, m] = first.split('-').map(Number);
    const [ly, lm] = last.split('-').map(Number);
    let prevBalance = account.startingBalance;

    while (y < ly || (y === ly && m <= lm)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const bal = monthMap.get(key) ?? prevBalance;
      const label = new Date(y, m - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      result.push({ month: label, solde: Math.round(bal * 100) / 100 });
      prevBalance = bal;
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return result;
  }, [account, transactions]);

  if (!account) {
    return (
      <Layout>
        <div className="p-8 text-center text-muted-foreground">
          <p>Compte introuvable</p>
          <button onClick={() => navigate('/savings')} className="mt-4 text-primary underline">Retour aux comptes bancaires</button>
        </div>
      </Layout>
    );
  }

  const openEdit = () => {
    setEditName(account.name);
    setEditType(account.type);
    setEditCurrency(account.currency);
    setEditBalance(String(account.startingBalance));
    setEditDate(account.startingDate);
    setShowEdit(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    updateAccount(account.id, {
      name: editName.trim(),
      type: editType as any,
      currency: editCurrency,
      startingBalance: parseFloat(editBalance) || 0,
      startingDate: editDate,
    });
    setShowEdit(false);
  };

  const handleArchive = () => {
    archiveAccount(account.id);
    navigate('/savings');
  };

  const handleDelete = () => {
    const success = deleteAccount(account.id);
    if (success) {
      navigate('/savings');
    } else {
      toast.error('Impossible de supprimer : des transactions sont liées à ce compte. Archivez-le plutôt.');
    }
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <BackHeader fallback="/savings" />

        {/* Hero Card */}
        <div className="bg-primary rounded-2xl p-5 shadow-lg shadow-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <AccountIcon type={account.type} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary-foreground">{account.name}</h1>
              <p className="text-xs text-primary-foreground/70">{typeInfo?.label || account.type} • {account.currency}</p>
            </div>
          </div>

          <p className="text-xs text-primary-foreground/60 mb-1">Solde actuel</p>
          <p className="text-3xl font-bold font-mono-amount text-primary-foreground">
            {formatAmount(balance, account.currency)}
          </p>

          <div className="flex items-center gap-1.5 mt-2">
            {netChange >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-primary-foreground/80" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-primary-foreground/80" />
            )}
            <span className="text-xs text-primary-foreground/70">
              {netChange >= 0 ? '+' : ''}{formatAmount(netChange, account.currency)} depuis l'ouverture
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl border border-border/40 p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-muted-foreground font-medium">Entrées</p>
            </div>
            <p className="text-sm font-bold font-mono-amount text-primary">
              +{formatAmount(totalIncome, account.currency)}
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/40 p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
              <p className="text-[10px] text-muted-foreground font-medium">Sorties</p>
            </div>
            <p className="text-sm font-bold font-mono-amount text-destructive">
              -{formatAmount(totalExpense, account.currency)}
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/40 p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground font-medium">Ouverture</p>
            </div>
            <p className="text-xs font-semibold text-foreground">
              {formatDate(account.startingDate)}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {formatAmount(account.startingBalance, account.currency)}
            </p>
          </div>
        </div>

        {/* Chart toggle button + collapsible chart */}
        {chartData.length > 1 && (
          <div>
            <button
              onClick={() => setShowChart(!showChart)}
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-border/40 bg-card text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span>Évolution du solde</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showChart ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showChart && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card rounded-b-xl border border-t-0 border-border/40 p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="soldeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.75rem',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [formatAmount(value, account.currency), 'Solde']}
                        />
                        <Area
                          type="monotone"
                          dataKey="solde"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#soldeGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={openEdit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/40 bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Modifier
          </button>
          {!showArchiveConfirm ? (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-border/40 bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <Archive className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex-1 p-3 rounded-xl border border-destructive/40 bg-destructive/5 space-y-2">
              <p className="text-sm text-center">Archiver ce compte ?</p>
              <div className="flex gap-2">
                <button onClick={() => setShowArchiveConfirm(false)} className="flex-1 py-2 rounded-lg border border-border text-xs hover:bg-muted">Non</button>
                <button onClick={handleArchive} className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold">Oui</button>
              </div>
            </div>
          )}
          {transactions.length === 0 && (
            <button
              onClick={handleDelete}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Transactions list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Transactions</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{transactions.length}</span>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">Aucune transaction liée à ce compte</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border/40 overflow-hidden divide-y divide-border/30">
              {displayedTransactions.map(t => {
                const member = getMemberById(t.memberId);
                return (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon category={t.category} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(t.date)}{member ? ` • ${member.name}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`font-mono-amount font-semibold text-sm whitespace-nowrap ml-3 ${t.type === 'income' ? 'text-primary' : 'text-destructive'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatAmount(t.amount, t.currency)}
                    </span>
                  </div>
                );
              })}

              {transactions.length > 10 && !showAllTransactions && (
                <button
                  onClick={() => setShowAllTransactions(true)}
                  className="w-full py-3 text-xs text-primary font-medium hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
                >
                  Voir toutes les transactions ({transactions.length})
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Edit Modal */}
        <AnimatePresence>
          {showEdit && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-5">Modifier le compte</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nom</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Type</label>
                    <select value={editType} onChange={e => setEditType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {allAccountTypes.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Devise</label>
                    <select value={editCurrency} onChange={e => setEditCurrency(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} {c}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Solde de base</label>
                      <input type="number" step="0.01" value={editBalance} onChange={e => setEditBalance(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Date de base</label>
                      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowEdit(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                  <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Sauvegarder</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
};

export default AccountDetail;
