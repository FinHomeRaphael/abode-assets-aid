import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: '🇪🇺 Euro (EUR)' },
  { value: 'USD', label: '🇺🇸 Dollar américain (USD)' },
  { value: 'GBP', label: '🇬🇧 Livre sterling (GBP)' },
  { value: 'CHF', label: '🇨🇭 Franc suisse (CHF)' },
];

const SignupPage = () => {
  const navigate = useNavigate();
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

  const validate = () => {
    const e: Record<string, string> = {};
    if (firstName.trim().length < 2) e.firstName = 'Le prénom doit contenir au moins 2 caractères';
    if (lastName.trim().length < 2) e.lastName = 'Le nom doit contenir au moins 2 caractères';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Adresse email invalide';
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
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            currency,
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          toast.error('Cette adresse email est déjà utilisée');
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success('Compte créé ! Vérifiez votre email pour confirmer votre inscription.');
      navigate('/login');
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🏠</div>
          <h1 className="text-2xl font-bold text-foreground">FineHome</h1>
          <p className="text-muted-foreground mt-1">Créez votre compte</p>
        </div>

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
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@exemple.com" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Devise principale</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {CURRENCY_OPTIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

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
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>

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
