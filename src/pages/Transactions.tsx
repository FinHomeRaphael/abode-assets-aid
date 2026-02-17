import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatAmount, formatDate } from '@/utils/format';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';

const Transactions = () => {
  const { transactions, getMemberById, household, getTransactionsForMonth } = useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterMember, setFilterMember] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthTx = useMemo(() => getTransactionsForMonth(currentMonth), [currentMonth, getTransactionsForMonth]);

  const categories = [...new Set(monthTx.map(t => t.category))].sort();

  const filtered = monthTx.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterMember !== 'all' && t.memberId !== filterMember) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (search && !t.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const monthIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">💳 Transactions</h1>
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

        {/* Month totals */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Revenus</p>
            <p className="font-mono font-bold text-success text-sm">+{formatAmount(monthIncome)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Dépenses</p>
            <p className="font-mono font-bold text-destructive text-sm">-{formatAmount(monthExpense)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Solde</p>
            <p className={`font-mono font-bold text-sm ${monthIncome - monthExpense >= 0 ? 'text-success' : 'text-destructive'}`}>
              {monthIncome - monthExpense >= 0 ? '+' : ''}{formatAmount(monthIncome - monthExpense)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-[200px]" />
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
            <option value="all">Tous types</option>
            <option value="income">Revenus</option>
            <option value="expense">Dépenses</option>
          </select>
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
            <option value="all">Tous membres</option>
            {household.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
            <option value="all">Toutes catégories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="bg-card rounded-lg border border-border divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Aucune transaction trouvée</div>
          ) : (
            filtered.map(t => {
              const member = getMemberById(t.memberId);
              return (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{t.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.category} · {member?.name} · {formatDate(t.date)}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-medium ${t.type === 'income' ? 'text-success' : ''}`}>
                    {t.type === 'income' ? '+' : '-'}{formatAmount(t.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">{filtered.length} transaction(s)</p>
      </motion.div>
    </Layout>
  );
};

export default Transactions;
