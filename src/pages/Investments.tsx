import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatAmount } from '@/utils/format';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['hsl(199, 89%, 48%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

const Investments = () => {
  const { investments, addInvestment } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [value, setValue] = useState('');

  const total = investments.reduce((s, i) => s + i.value, 0);
  const pieData = investments.map(i => ({ name: i.name, value: i.value }));

  const handleAdd = () => {
    if (!name || !type || !value) { toast.error('Remplissez tous les champs'); return; }
    addInvestment({ name, type, value: parseFloat(value), variation: 0, emoji: '📊' });
    toast.success('Actif ajouté ✓');
    setShowAdd(false);
    setName(''); setType(''); setValue('');
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">📈 Investissements</h1>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            + Ajouter un actif
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="font-semibold mb-4 text-sm">Répartition</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatAmount(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {investments.map((inv, i) => (
                <div key={inv.id} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{inv.name}</span>
                  <span className="ml-auto font-mono text-xs">{Math.round((inv.value / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="lg:col-span-2 space-y-3">
            {investments.map(i => (
              <div key={i.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between card-hover">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{i.emoji}</span>
                  <div>
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-medium">{formatAmount(i.value)}</p>
                  <p className={`text-sm font-mono ${i.variation >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {i.variation >= 0 ? '+' : ''}{i.variation}%
                  </p>
                </div>
              </div>
            ))}

            <div className="bg-foreground text-background rounded-lg p-5 text-center">
              <p className="text-sm text-background/60 mb-1">Valeur totale du portefeuille</p>
              <p className="text-2xl font-bold font-mono">{formatAmount(total)}</p>
            </div>
          </div>
        </div>

        {/* Add modal */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-lg border border-border shadow-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Ajouter un actif</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nom</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="ETF S&P 500" className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Type</label>
                    <select value={type} onChange={e => setType(e.target.value)} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm">
                      <option value="">Sélectionner...</option>
                      <option value="ETF">ETF</option>
                      <option value="Actions">Actions</option>
                      <option value="Épargne">Épargne</option>
                      <option value="Crypto">Crypto</option>
                      <option value="Immobilier">Immobilier</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Valeur actuelle (€)</label>
                    <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="10000" className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">Annuler</button>
                  <button onClick={handleAdd} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Ajouter</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
};

export default Investments;
