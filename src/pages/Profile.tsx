import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { formatDateLong, getInitials } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import ConvertedAmount from '@/components/ConvertedAmount';

const Profile = () => {
  const { household, currentUser, logout, resetDemo, customCategories, deleteCustomCategory, getRecurringTransactions, deleteRecurring, getMemberById, changeCurrency, addMember, removeMember, updateMemberRole } = useApp();
  const { formatAmount, currency } = useCurrency();
  const navigate = useNavigate();
  const recurringTx = getRecurringTransactions();

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try { return localStorage.getItem('finehome_notifications') !== 'false'; } catch { return true; }
  });

  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');

  const filteredCurrencies = CURRENCIES.filter(c => {
    const q = currencySearch.toLowerCase();
    if (!q) return true;
    const name = CURRENCY_NAMES[c] || '';
    return c.toLowerCase().includes(q) || name.toLowerCase().includes(q);
  });

  const handleInvite = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error('Remplissez tous les champs');
      return;
    }
    if (household.members.some(m => m.email === inviteEmail.trim())) {
      toast.error('Ce membre existe déjà');
      return;
    }
    addMember(inviteName.trim(), inviteEmail.trim(), inviteRole);
    toast.success(`${inviteName.trim()} ajouté(e) au foyer ✓`);
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('member');
  };

  const handleRemoveMember = (id: string, name: string) => {
    if (id === currentUser?.id) {
      toast.error('Vous ne pouvez pas vous retirer vous-même');
      return;
    }
    removeMember(id);
    toast.success(`${name} retiré(e) du foyer`);
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold">Profil & Foyer</h1>

        {/* User card */}
        <div className="card-elevated p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-lg font-bold">
            {currentUser ? getInitials(currentUser.name) : '?'}
          </div>
          <div>
            <p className="font-bold text-lg">{currentUser?.name}</p>
            <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
          </div>
        </div>

        {/* Household */}
        <div className="card-elevated p-5">
          <h2 className="font-semibold mb-3">🏠 {household.name}</h2>
          <p className="text-sm text-muted-foreground">Créé le {formatDateLong(household.createdAt)}</p>
        </div>

        {/* Currency */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold mb-1">💱 Devise par défaut</h2>
              <p className="text-sm text-muted-foreground">
                {CURRENCY_SYMBOLS[household.currency] || household.currency} — {CURRENCY_NAMES[household.currency] || household.currency} ({household.currency})
              </p>
            </div>
            <button
              onClick={() => setShowCurrencyModal(true)}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Modifier
            </button>
          </div>
        </div>

        {/* Members */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Membres ({household.members.length})</h2>
            <button onClick={() => setShowInviteModal(true)} className="text-sm text-primary font-medium hover:underline">+ Inviter</button>
          </div>
          <div className="space-y-3">
            {household.members.map(m => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">{getInitials(m.name)}</div>
                  <div>
                    <p className="text-sm font-semibold">{m.name} {m.id === currentUser?.id && <span className="text-xs text-muted-foreground">(vous)</span>}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={e => { updateMemberRole(m.id, e.target.value as 'admin' | 'member'); toast.success('Rôle mis à jour'); }}
                    className="text-xs px-2.5 py-1 rounded-lg border border-border bg-card font-medium"
                    disabled={m.id === currentUser?.id}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Membre</option>
                  </select>
                  {m.id !== currentUser?.id && (
                    <button onClick={() => handleRemoveMember(m.id, m.name)} className="text-xs text-destructive font-medium hover:underline">
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recurring Transactions */}
        <div className="card-elevated p-5">
          <h2 className="font-semibold mb-3">🔄 Transactions récurrentes</h2>
          {recurringTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune transaction récurrente.</p>
          ) : (
            <div className="space-y-2">
              {recurringTx.map(t => {
                const member = getMemberById(t.memberId);
                return (
                  <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">{t.emoji}</div>
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.category} · {member?.name} · Le {t.recurrenceDay} de chaque mois</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ConvertedAmount transaction={t} />
                      <button onClick={() => { deleteRecurring(t.id); toast.success('Récurrence désactivée'); }} className="text-xs text-destructive font-medium hover:underline">Supprimer</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Categories */}
        <div className="card-elevated p-5">
          <h2 className="font-semibold mb-3">Catégories personnalisées</h2>
          {customCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune catégorie personnalisée.</p>
          ) : (
            <div className="space-y-2">
              {customCategories.map(c => (
                <div key={c.name} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span>{c.emoji}</span>
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-muted text-muted-foreground font-medium">{c.type === 'expense' ? 'Dépense' : 'Revenu'}</span>
                  </div>
                  <button onClick={() => { deleteCustomCategory(c.name); toast.success('Catégorie supprimée'); }} className="text-xs text-destructive font-medium hover:underline">Supprimer</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="card-elevated p-5 space-y-3">
          <h2 className="font-semibold">Paramètres</h2>
          <div className="flex items-center justify-between text-sm">
            <span>🔔 Notifications</span>
            <div
              className={`w-10 h-6 rounded-full transition-colors cursor-pointer relative ${notificationsEnabled ? 'bg-primary' : 'bg-muted'}`}
              onClick={() => {
                const next = !notificationsEnabled;
                setNotificationsEnabled(next);
                localStorage.setItem('finehome_notifications', String(next));
                toast.success(next ? 'Notifications activées' : 'Notifications désactivées');
              }}
            >
              <div className={`w-4 h-4 bg-card rounded-full absolute top-1 transition-transform ${notificationsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </div>
          <button onClick={() => navigate('/start-of-month')} className="w-full flex items-center justify-between text-sm py-2 hover:bg-muted rounded-lg px-2 -mx-2 transition-colors">
            <span>🗓️ Mode début de mois</span>
            <span className="text-muted-foreground">→</span>
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-2 pb-4">
          <button onClick={() => { toast.info('Export en cours...'); setTimeout(() => toast.success('Données exportées ✓'), 1500); }} className="w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">📁 Exporter mes données</button>
          <button onClick={resetDemo} className="w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">🔄 Réinitialiser les données de démo</button>
          <button onClick={logout} className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors">Déconnexion</button>
        </div>
      </motion.div>

      {/* Currency Modal */}
      <AnimatePresence>
        {showCurrencyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCurrencyModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6 max-h-[80vh] flex flex-col">
              <h2 className="text-lg font-bold mb-4">Choisir la devise</h2>
              <input
                value={currencySearch}
                onChange={e => setCurrencySearch(e.target.value)}
                placeholder="🔍 Rechercher une devise..."
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-3"
                autoFocus
              />
              <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
                {filteredCurrencies.map(c => (
                  <button
                    key={c}
                    onClick={() => { changeCurrency(c); toast.success(`Devise changée en ${c}`); setShowCurrencyModal(false); setCurrencySearch(''); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all text-left ${
                      household.currency === c ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
                    }`}
                  >
                    <div>
                      <span className="font-medium">{CURRENCY_SYMBOLS[c] || c}</span>
                      <span className="ml-2 text-muted-foreground">{c}</span>
                      {CURRENCY_NAMES[c] && <span className="ml-2 text-xs text-muted-foreground">— {CURRENCY_NAMES[c]}</span>}
                    </div>
                    {household.currency === c && <span className="text-primary">✓</span>}
                  </button>
                ))}
                {filteredCurrencies.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune devise trouvée</p>
                )}
              </div>
              <button onClick={() => { setShowCurrencyModal(false); setCurrencySearch(''); }} className="w-full mt-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Fermer</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6">
              <h2 className="text-lg font-bold mb-5">Inviter un membre</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nom</label>
                  <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Prénom ou nom complet" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemple.com" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Rôle</label>
                  <div className="flex gap-2">
                    <button onClick={() => setInviteRole('member')} className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${inviteRole === 'member' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                      👤 Membre
                    </button>
                    <button onClick={() => setInviteRole('admin')} className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${inviteRole === 'admin' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                      👑 Admin
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {inviteRole === 'admin' ? 'Les admins peuvent gérer les membres et les paramètres du foyer.' : 'Les membres peuvent ajouter des transactions et consulter les données.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowInviteModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                <button onClick={handleInvite} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Inviter</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default Profile;
