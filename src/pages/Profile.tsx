import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { formatDateLong, getInitials, formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import BackHeader from '@/components/BackHeader';
import ConvertedAmount from '@/components/ConvertedAmount';
import InviteMemberModal from '@/components/InviteMemberModal';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PremiumPaywall';
import { Crown, Pencil, Check, X } from 'lucide-react';

const HouseholdNameCard = ({ initialName, createdAt, onRename }: { initialName: string; createdAt?: string; onRename: (name: string) => Promise<void> }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);

  useEffect(() => { setName(initialName); }, [initialName]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onRename(trimmed);
    setEditing(false);
  };

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between">
        {editing ? (
          <div className="flex items-center gap-2 flex-1 mr-2">
            <span className="text-lg">🏠</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <button onClick={save} className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"><Check className="w-4 h-4" /></button>
            <button onClick={() => { setName(initialName); setEditing(false); }} className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="font-semibold mb-1">🏠 {initialName}</h2>
              <p className="text-sm text-muted-foreground">Créé le {createdAt ? formatDateLong(createdAt) : '—'}</p>
            </div>
            <button onClick={() => setEditing(true)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const Profile = () => {
  const { household, currentUser, logout, resetDemo, customCategories, deleteCustomCategory, getRecurringTransactions, deleteRecurring, getMemberById, changeCurrency, addMember, removeMember, updateMemberRole, householdId, budgets, savingsGoals, renameHousehold } = useApp();
  const { formatAmount, currency } = useCurrency();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isPremium, subscriptionEnd, startCheckout, openPortal, checkSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const recurringTx = getRecurringTransactions();

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try { return localStorage.getItem('finehome_notifications') !== 'false'; } catch { return true; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  

  // Pending invitations
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);

  const fetchInvitations = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase
      .from('invitations')
      .select('*')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingInvitations(data || []);
  }, [householdId]);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  const cancelInvitation = async (id: string, email: string) => {
    await supabase.from('invitations').delete().eq('id', id);
    setPendingInvitations(prev => prev.filter(i => i.id !== id));
    // silent
  };

  const resendInvitation = async (inv: any) => {
    const isExpired = new Date(inv.expires_at) < new Date();
    if (isExpired) {
      const newToken = crypto.randomUUID();
      await supabase.from('invitations').update({
        token: newToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', inv.id);
      const inviteUrl = `${window.location.origin}/signup?invitation=${newToken}`;
      // silent
      toast.info(`🔗 ${inviteUrl}`, { duration: 15000 });
      fetchInvitations();
    } else {
      const inviteUrl = `${window.location.origin}/signup?invitation=${inv.token}`;
      toast.info(`🔗 ${inviteUrl}`, { duration: 15000 });
    }
  };

  const filteredCurrencies = CURRENCIES.filter(c => {
    const q = currencySearch.toLowerCase();
    if (!q) return true;
    const name = CURRENCY_NAMES[c] || '';
    return c.toLowerCase().includes(q) || name.toLowerCase().includes(q);
  });

  const handleRemoveMember = (id: string, name: string) => {
    if (id === currentUser?.id) {
      toast.error('Vous ne pouvez pas vous retirer vous-même');
      return;
    }
    removeMember(id);
    // silent
  };

  // Fetch debts count for usage display
  const [debtsCount, setDebtsCount] = useState(0);
  useEffect(() => {
    if (!householdId) return;
    supabase.from('debts').select('id', { count: 'exact', head: true }).eq('household_id', householdId).then(({ count }) => {
      setDebtsCount(count || 0);
    });
  }, [householdId]);

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-4">
        <BackHeader title="Profil & Foyer" />

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


        {/* Subscription — only for premium users */}
        {isPremium && (
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                Abonnement
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">Premium</span>
            </div>
            <div className="space-y-2">
              {subscriptionEnd && <p className="text-sm text-muted-foreground">Renouvellement : {formatDateLong(subscriptionEnd)}</p>}
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                👨‍👩‍👧‍👦 Le Premium est partagé avec tous les membres du foyer.
              </p>
              <button onClick={openPortal} className="w-full py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Gérer mon abonnement
              </button>
            </div>
          </div>
        )}

        {/* Household */}
        <HouseholdNameCard initialName={household.name} createdAt={household.createdAt} onRename={renameHousehold} />

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
            <h2 className="font-semibold">
              Membres ({household.members.length})
            </h2>
            <button onClick={() => setShowInviteModal(true)} className="text-sm text-primary font-medium hover:underline">+ Inviter un membre</button>
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
                    onChange={e => { updateMemberRole(m.id, e.target.value as 'admin' | 'member'); }}
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

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">📨 Invitations en attente ({pendingInvitations.length})</h3>
              <div className="space-y-2">
                {pendingInvitations.map(inv => {
                  const isExpired = new Date(inv.expires_at) < new Date();
                  return (
                    <div key={inv.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Envoyée le {inv.created_at ? formatDate(inv.created_at) : '—'}
                          {isExpired && <span className="text-destructive ml-1">· Expirée</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpired && (
                          <button onClick={() => resendInvitation(inv)} className="text-xs text-primary font-medium hover:underline">
                            Renvoyer
                          </button>
                        )}
                        <button onClick={() => cancelInvitation(inv.id, inv.email)} className="text-xs text-destructive font-medium hover:underline">
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                      <button onClick={() => { deleteRecurring(t.id); }} className="text-xs text-destructive font-medium hover:underline">Supprimer</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Categories */}
        <div className="card-elevated p-5">
          <h2 className="font-semibold mb-3">
            Catégories personnalisées
          </h2>
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
                  <button onClick={() => { deleteCustomCategory(c.name); }} className="text-xs text-destructive font-medium hover:underline">Supprimer</button>
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
                // silent
              }}
            >
              <div className={`w-4 h-4 bg-card rounded-full absolute top-1 transition-transform ${notificationsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>🌙 Mode sombre</span>
            <div
              className={`w-10 h-6 rounded-full transition-colors cursor-pointer relative ${darkMode ? 'bg-primary' : 'bg-muted'}`}
              onClick={() => {
                const next = !darkMode;
                setDarkMode(next);
                document.documentElement.classList.toggle('dark', next);
                localStorage.setItem('finehome_theme', next ? 'dark' : 'light');
                // silent
              }}
            >
              <div className={`w-4 h-4 bg-card rounded-full absolute top-1 transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </div>
          <button onClick={() => navigate('/start-of-month')} className="w-full flex items-center justify-between text-sm py-2 hover:bg-muted rounded-lg px-2 -mx-2 transition-colors">
            <span>🗓️ Mode début de mois</span>
            <span className="text-muted-foreground">→</span>
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-2 pb-4">
          <button onClick={handleLogout} className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors">Déconnexion</button>
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
                    onClick={() => { changeCurrency(c); setShowCurrencyModal(false); setCurrencySearch(''); }}
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
      <InviteMemberModal open={showInviteModal} onClose={() => setShowInviteModal(false)} onInviteSent={fetchInvitations} />
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} feature="Premium" description="Débloquez toutes les fonctionnalités avancées." />
    </Layout>
  );
};

export default Profile;
