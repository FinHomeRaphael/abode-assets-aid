import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { useSubscription, FREEMIUM_LIMITS, FOYER_LIMITS, FAMILLE_LIMITS } from '@/hooks/useSubscription';

interface Props {
  open: boolean;
  onClose: () => void;
  onInviteSent: () => void;
}

const InviteMemberModal = ({ open, onClose, onInviteSent }: Props) => {
  const { householdId, currentUser, household } = useApp();
  const { plan } = useSubscription();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Adresse email invalide');
      return;
    }

    setLoading(true);
    try {
      // Check member limit (existing members + pending invitations)
      const memberLimit = plan === 'famille' ? FAMILLE_LIMITS.members : plan === 'foyer' ? FOYER_LIMITS.members : FREEMIUM_LIMITS.members;
      
      const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
        supabase.from('household_members').select('*', { count: 'exact', head: true }).eq('household_id', householdId),
        supabase.from('invitations').select('*', { count: 'exact', head: true }).eq('household_id', householdId).eq('status', 'pending'),
      ]);

      const totalSlots = (memberCount || 0) + (pendingCount || 0);
      if (totalSlots >= memberLimit) {
        const planName = plan === 'famille' ? 'Famille' : plan === 'foyer' ? 'Foyer' : 'Gratuit';
        toast.error(`Limite de ${memberLimit} membre(s) atteinte pour le plan ${planName} (invitations en attente incluses).`);
        setLoading(false);
        return;
      }
      const token = crypto.randomUUID();
      const { error } = await supabase.from('invitations').insert({
        household_id: householdId,
        email: trimmed,
        invited_by: currentUser?.id || null,
        token,
        status: 'pending',
        role: 'member',
      });

      if (error) {
        if (error.message.includes('duplicate') || error.code === '23505') {
          toast.error('Une invitation est déjà en attente pour cet email');
        } else {
          toast.error('Erreur lors de l\'envoi de l\'invitation');
          console.error(error);
        }
        return;
      }

      const inviteUrl = `${window.location.origin}/signup?invitation=${token}`;

      // Send email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          email: trimmed,
          inviterName: currentUser?.name || 'Quelqu\'un',
          householdName: household.name,
          inviteUrl,
        },
      });

      if (emailError) {
        console.error('Email send error:', emailError);
        toast.warning(`Invitation créée mais l'email n'a pas pu être envoyé. Lien copié dans la console.`);
        console.log('🔗 Lien d\'invitation:', inviteUrl);
      } else {
        // silent
      }

      setEmail('');
      onInviteSent();
      onClose();
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6">
            <h2 className="text-lg font-bold mb-2">Inviter un membre</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Invitez quelqu'un à rejoindre votre foyer. Il recevra un email avec un lien d'inscription.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
              <button onClick={handleSend} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                {loading ? 'Envoi...' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InviteMemberModal;
