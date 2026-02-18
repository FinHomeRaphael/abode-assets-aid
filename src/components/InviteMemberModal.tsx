import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onInviteSent: () => void;
}

const InviteMemberModal = ({ open, onClose, onInviteSent }: Props) => {
  const { householdId, currentUser } = useApp();
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
      console.log('🔗 Lien d\'invitation:', inviteUrl);
      toast.success(`Invitation envoyée à ${trimmed}`, {
        description: 'Le lien a été affiché dans la console (mode test)',
        duration: 8000,
      });
      toast.info(`🔗 ${inviteUrl}`, { duration: 15000 });

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
              Invitez quelqu'un à rejoindre votre foyer. Il recevra un lien d'inscription.
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
