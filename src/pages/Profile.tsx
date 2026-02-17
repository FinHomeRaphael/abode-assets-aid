import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatDateLong, formatAmount, getInitials } from '@/utils/format';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

const Profile = () => {
  const { household, currentUser, logout, resetDemo, customCategories, deleteCustomCategory, getRecurringTransactions, deleteRecurring, getMemberById } = useApp();
  const recurringTx = getRecurringTransactions();

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
          <p className="text-sm text-muted-foreground">Devise : {household.currency}</p>
        </div>

        {/* Members */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Membres</h2>
            <button className="text-sm text-primary font-medium hover:underline" onClick={() => toast.info('Fonctionnalité à venir')}>+ Inviter</button>
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
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${m.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {m.role === 'admin' ? 'Admin' : 'Membre'}
                </span>
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
                        <p className="text-xs text-muted-foreground">
                          {t.category} · {member?.name} · Le {t.recurrenceDay} de chaque mois
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-mono-amount text-sm font-semibold ${t.type === 'income' ? 'text-success' : ''}`}>
                        {t.type === 'income' ? '+' : '-'}{formatAmount(t.amount)}
                      </span>
                      <button onClick={() => { deleteRecurring(t.id); toast.success('Récurrence désactivée'); }} className="text-xs text-destructive font-medium hover:underline">
                        Supprimer
                      </button>
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
            <span>Devise par défaut</span>
            <span className="font-semibold">{household.currency}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Notifications</span>
            <span className="text-success font-semibold">Activées</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pb-4">
          <button onClick={() => { toast.info('Export en cours...'); setTimeout(() => toast.success('Données exportées ✓'), 1500); }} className="w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">📁 Exporter mes données</button>
          <button onClick={resetDemo} className="w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">🔄 Réinitialiser les données de démo</button>
          <button onClick={logout} className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors">Déconnexion</button>
        </div>
      </motion.div>
    </Layout>
  );
};

export default Profile;
