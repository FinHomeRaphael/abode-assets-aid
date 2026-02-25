import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CURRENCIES, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '@/types/finance';

interface InvitationData {
  invitation_id: string;
  household_name: string;
  household_currency: string;
  member_count: number;
  inviter_name: string;
  hasExistingHousehold: boolean;
}

interface Props {
  open: boolean;
  invitation: InvitationData | null;
  onComplete: () => void;
}

const InvitationChoiceModal = ({ open, invitation, onComplete }: Props) => {
  const [mode, setMode] = useState<'choice' | 'create'>('choice');
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(false);

  if (!invitation) return null;

  const handleJoin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('accept_invitation', {
        _invitation_id: invitation.invitation_id,
      });
      if (error) throw error;
      // silent
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'acceptation');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('decline_invitation', {
        _invitation_id: invitation.invitation_id,
        _currency: currency,
      });
      if (error) throw error;
      // silent
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6">
            {mode === 'choice' ? (
              <>
                <div className="text-center mb-5">
                  <div className="text-4xl mb-3">🎉</div>
                  <h2 className="text-lg font-bold">Vous avez été invité !</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {invitation.inviter_name} vous a invité à rejoindre :
                  </p>
                </div>

                <div className="bg-muted rounded-xl p-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">🏠</div>
                    <div>
                      <p className="font-semibold">{invitation.household_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {invitation.member_count} membre{invitation.member_count > 1 ? 's' : ''} · {CURRENCY_SYMBOLS[invitation.household_currency] || invitation.household_currency} {invitation.household_currency}
                      </p>
                    </div>
                  </div>
                </div>

                {invitation.hasExistingHousehold && (
                  <div className="bg-destructive/10 text-destructive text-xs rounded-xl p-3 mb-4">
                    ⚠️ Rejoindre ce foyer vous fera quitter votre foyer actuel.
                  </div>
                )}

                <div className="space-y-2">
                  <button onClick={handleJoin} disabled={loading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {loading ? 'En cours...' : 'Rejoindre ce foyer'}
                  </button>
                  <button onClick={() => setMode('create')} disabled={loading} className="w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                    Créer mon propre foyer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold mb-2">Créer mon foyer</h2>
                <p className="text-sm text-muted-foreground mb-4">Choisissez la devise de votre foyer :</p>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-5"
                >
                  {['EUR', 'USD', 'GBP', 'CHF'].map(c => (
                    <option key={c} value={c}>{CURRENCY_SYMBOLS[c]} {CURRENCY_NAMES[c]} ({c})</option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <button onClick={() => setMode('choice')} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Retour</button>
                  <button onClick={handleDecline} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {loading ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InvitationChoiceModal;
