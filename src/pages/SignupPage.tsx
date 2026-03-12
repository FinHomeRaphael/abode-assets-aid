import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { toast } from 'sonner';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { trackEvent } from '@/utils/metaPixel';

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: '🇪🇺 Euro (EUR)' },
  { value: 'USD', label: '🇺🇸 Dollar américain (USD)' },
  { value: 'GBP', label: '🇬🇧 Livre sterling (GBP)' },
  { value: 'CHF', label: '🇨🇭 Franc suisse (CHF)' },
];

interface InvitationInfo {
  valid: boolean;
  email?: string;
  household_id?: string;
  household_name?: string;
  household_currency?: string;
  member_count?: number;
  inviter_name?: string;
  invitation_id?: string;
}

const SignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('invitation');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Invitation state
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(!!invitationToken);
  const [invitationError, setInvitationError] = useState('');

  useEffect(() => {
    if (!invitationToken) return;
    const validateToken = async () => {
      setInvitationLoading(true);
      try {
        const { data, error } = await supabase.rpc('validate_invitation_token', { _token: invitationToken });
        if (error) throw error;
        const info = data as unknown as InvitationInfo;
        if (info.valid) {
          setInvitationInfo(info);
          setEmail(info.email || '');
        } else {
          setInvitationError('Ce lien d\'invitation est invalide ou expiré.');
        }
      } catch {
        setInvitationError('Erreur lors de la vérification de l\'invitation.');
      } finally {
        setInvitationLoading(false);
      }
    };
    validateToken();
  }, [invitationToken]);

  const isInvited = !!invitationInfo?.valid;

  const validate = () => {
    const e: Record<string, string> = {};
    if (firstName.trim().length < 2) e.firstName = 'Le prénom doit contenir au moins 2 caractères';
    if (lastName.trim().length < 2) e.lastName = 'Le nom doit contenir au moins 2 caractères';
    if (!isInvited && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) e.email = 'Adresse email invalide';
    if (password.length < 8) e.password = 'Le mot de passe doit contenir au moins 8 caractères';
    if (password !== confirmPassword) e.confirmPassword = 'Les mots de passe ne correspondent pas';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const metadata: Record<string, any> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      };

      if (isInvited) {
        metadata.skip_household_creation = true;
        metadata.invitation_id = invitationInfo!.invitation_id;
      } else {
        metadata.currency = currency;
      }

      const { error } = await supabase.auth.signUp({
        email: (isInvited ? invitationInfo!.email : email.trim()) as string,
        password,
        options: {
          data: metadata,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          toast.error('Cette adresse email est déjà utilisée. Connectez-vous pour accepter l\'invitation.');
        } else {
          toast.error(error.message);
        }
        return;
      }
      trackEvent('CompleteRegistration', { currency: isInvited ? invitationInfo!.household_currency : currency });
      navigate('/login');
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (invitationLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📨</div>
          <p className="text-muted-foreground">Vérification de l'invitation...</p>
        </div>
      </div>
    );
  }

  if (invitationToken && invitationError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <div className="text-4xl mb-3">❌</div>
          <h1 className="text-xl font-bold mb-2">Invitation invalide</h1>
          <p className="text-muted-foreground mb-6">{invitationError}</p>
          <Link to="/signup" className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Créer un compte normalement
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">{isInvited ? '📨' : '🏠'}</div>
          <h1 className="text-2xl font-bold text-foreground">FineHome</h1>
          <p className="text-muted-foreground mt-1">
            {isInvited ? `Rejoignez le foyer "${invitationInfo!.household_name}"` : 'Créez votre compte'}
          </p>
        </div>

        {isInvited && (
          <div className="bg-muted rounded-xl p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">🏠</div>
            <div>
              <p className="text-sm font-semibold">{invitationInfo!.household_name}</p>
              <p className="text-xs text-muted-foreground">
                Invité par {invitationInfo!.inviter_name} · {invitationInfo!.member_count} membre{(invitationInfo!.member_count || 0) > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-card-lg p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Prénom</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Nom</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => !isInvited && setEmail(e.target.value)}
                placeholder="jean@exemple.com"
                readOnly={isInvited}
                className={`w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring ${isInvited ? 'pr-10 bg-muted cursor-not-allowed' : ''}`}
              />
              {isInvited && (
                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              )}
            </div>
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          {!isInvited && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Devise principale</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {CURRENCY_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Mot de passe</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 caractères" className="w-full px-4 py-3 pr-12 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Confirmer le mot de passe</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmer" className="w-full px-4 py-3 pr-12 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>}
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
            {loading ? 'Création...' : isInvited ? 'Créer mon compte et rejoindre' : 'Créer mon compte'}
          </button>

          {!isInvited && (
            <>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-input" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const { error } = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (error) toast.error("Erreur lors de la connexion Google");
                }}
                className="w-full py-3 rounded-xl border border-input bg-background font-semibold text-sm hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                S'inscrire avec Google
              </button>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">Se connecter</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default SignupPage;
