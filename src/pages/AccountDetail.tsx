import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateLong } from '@/utils/format';
import { ACCOUNT_TYPES, CURRENCIES, CURRENCY_SYMBOLS } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import BackHeader from '@/components/BackHeader';

const AccountDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { scopedAccounts: accounts, getAccountBalance, getAccountTransactions, updateAccount, archiveAccount, deleteAccount, getMemberById } = useApp();
  const { formatAmount } = useCurrency();

  const account = accounts.find(a => a.id === id);
  const [showEdit, setShowEdit] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<string>('');
  const [editCurrency, setEditCurrency] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editDate, setEditDate] = useState('');

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

  const balance = getAccountBalance(account.id);
  const transactions = getAccountTransactions(account.id);
  const typeInfo = ACCOUNT_TYPES.find(t => t.value === account.type);

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
    // silent
    setShowEdit(false);
  };

  const handleArchive = () => {
    archiveAccount(account.id);
    // silent
    navigate('/savings');
  };

  const handleDelete = () => {
    const success = deleteAccount(account.id);
    if (success) {
      // silent
      navigate('/savings');
    } else {
      toast.error('Impossible de supprimer : des transactions sont liées à ce compte. Archivez-le plutôt.');
    }
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center gap-3">
          <BackHeader fallback="/savings" />
          <h1 className="text-xl font-bold flex-1">{typeInfo?.emoji} {account.name}</h1>
          <button onClick={openEdit} className="h-9 px-3 rounded-xl border border-border text-sm hover:bg-muted transition-colors">Modifier</button>
        </div>

        {/* Balance card */}
        <div className="card-elevated p-5">
          <p className="text-xs text-muted-foreground mb-1">Solde actuel</p>
          <p className={`text-2xl font-bold font-mono-amount ${balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatAmount(balance, account.currency)}
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>Type : {typeInfo?.label || account.type}</span>
            <span>Devise : {account.currency}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Solde de base : {formatAmount(account.startingBalance, account.currency)} au {formatDateLong(account.startingDate)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {!showArchiveConfirm ? (
            <button onClick={() => setShowArchiveConfirm(true)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              📦 Archiver
            </button>
          ) : (
            <div className="flex-1 p-3 rounded-xl border border-destructive bg-destructive/5 space-y-2">
              <p className="text-sm text-center">Archiver ce compte ?</p>
              <div className="flex gap-2">
                <button onClick={() => setShowArchiveConfirm(false)} className="flex-1 py-2 rounded-lg border border-border text-xs hover:bg-muted">Non</button>
                <button onClick={handleArchive} className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold">Oui</button>
              </div>
            </div>
          )}
          {transactions.length === 0 && (
            <button onClick={handleDelete} className="py-2.5 px-4 rounded-xl border border-destructive text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors">
              🗑 Supprimer
            </button>
          )}
        </div>

        {/* Transactions list */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Transactions ({transactions.length})</h2>
          {transactions.length === 0 ? (
            <div className="card-elevated p-6 text-center text-sm text-muted-foreground">Aucune transaction liée</div>
          ) : (
            <div className="space-y-1.5">
              {transactions.map(t => {
                const member = getMemberById(t.memberId);
                return (
                  <div key={t.id} className="card-elevated p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{t.emoji}</span>
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{formatDateLong(t.date)}{member ? ` • ${member.name}` : ''}</p>
                      </div>
                    </div>
                    <span className={`font-mono-amount font-semibold text-sm ${t.type === 'income' ? 'text-primary' : 'text-destructive'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatAmount(t.amount, t.currency)}
                    </span>
                  </div>
                );
              })}
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
                      {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
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
