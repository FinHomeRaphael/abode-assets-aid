import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { CURRENCIES, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '@/types/finance';
import logo from '@/assets/logo.png';
import { trackEvent, trackCustomEvent } from '@/utils/metaPixel';

const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Veuillez entrer votre adresse email'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Un email de réinitialisation vous a été envoyé');
      setIsForgotPassword(false);
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Veuillez remplir tous les champs'); return; }
    if (isRegister && !firstName) { toast.error('Veuillez entrer votre prénom'); return; }
    if (isRegister && !lastName) { toast.error('Veuillez entrer votre nom de famille'); return; }

    setIsLoading(true);
    try {
      if (isRegister) {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName, last_name: lastName, currency } },
        });
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Cet email est déjà utilisé');
          } else {
            toast.error(error.message);
          }
          return;
        }

        if (signUpData.session) {
          trackEvent('CompleteRegistration', { currency });
          await createHousehold(signUpData.session.user.id, lastName, currency);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Invalid login')) {
            toast.error('Email ou mot de passe incorrect');
          } else if (error.message.includes('Email not confirmed')) {
            toast.error('Veuillez confirmer votre email avant de vous connecter');
          } else {
            toast.error(error.message);
          }
          return;
        }
        trackCustomEvent('Login');
      }
    } catch (err: any) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const createHousehold = async (userId: string, householdName: string, cur: string) => {
    const { data: newHousehold, error: hError } = await supabase
      .from('households')
      .insert({ name: `Famille ${householdName}`, default_currency: cur })
      .select()
      .single();

    if (hError || !newHousehold) {
      console.error('Household creation error:', hError);
      return;
    }

    const hId = (newHousehold as any).id;
    await supabase
      .from('household_members')
      .insert({ household_id: hId, user_id: userId, role: 'admin' });
  };

  const filteredCurrencies = CURRENCIES.filter(c => {
    const q = currencySearch.toLowerCase();
    if (!q) return true;
    return c.toLowerCase().includes(q) || (CURRENCY_NAMES[c] || '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="FinHome" className="w-16 h-16 rounded-3xl mx-auto mb-4 object-cover" />
          <h1 className="text-2xl font-bold mb-1">FinHome</h1>
          <p className="text-muted-foreground text-sm">Gérez les finances de votre foyer</p>
        </div>

        <div className="card-elevated p-8">
          {isForgotPassword ? (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-1">Mot de passe oublié</h2>
                <p className="text-sm text-muted-foreground">Entrez votre email pour recevoir un lien de réinitialisation.</p>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="thomas@finhome.app" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isLoading ? '...' : 'Envoyer le lien'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Retour à la connexion
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex mb-6 bg-muted rounded-xl p-1">
                <button onClick={() => setIsRegister(false)} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${!isRegister ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                  Connexion
                </button>
                <button onClick={() => setIsRegister(true)} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${isRegister ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                  Inscription
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-1.5">Nom</label>
                        <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-1.5">Prénom</label>
                        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Thomas" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Devise principale</label>
                      <button
                        type="button"
                        onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                        className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <span>{CURRENCY_SYMBOLS[currency] || currency} {currency} {CURRENCY_NAMES[currency] ? `— ${CURRENCY_NAMES[currency]}` : ''}</span>
                        <span className="text-muted-foreground">{showCurrencyPicker ? '▲' : '▼'}</span>
                      </button>
                      {showCurrencyPicker && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 border border-input rounded-xl overflow-hidden bg-background">
                          <input
                            value={currencySearch}
                            onChange={e => setCurrencySearch(e.target.value)}
                            placeholder="🔍 Rechercher..."
                            className="w-full px-4 py-2.5 text-sm border-b border-input focus:outline-none"
                          />
                          <div className="max-h-36 overflow-y-auto">
                            {filteredCurrencies.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => { setCurrency(c); setShowCurrencyPicker(false); setCurrencySearch(''); }}
                                className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-all ${
                                  currency === c ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
                                }`}
                              >
                                <span>
                                  <span className="font-medium">{CURRENCY_SYMBOLS[c] || c}</span>
                                  <span className="ml-2 text-muted-foreground">{c}</span>
                                  {CURRENCY_NAMES[c] && <span className="ml-2 text-xs text-muted-foreground">— {CURRENCY_NAMES[c]}</span>}
                                </span>
                                {currency === c && <span className="text-primary">✓</span>}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="thomas@finhome.app" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Mot de passe</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                {!isRegister && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isLoading ? '...' : (isRegister ? "Créer mon compte" : "Se connecter")}
                </button>

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
                  Continuer avec Google
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {isForgotPassword ? 'Vérifiez vos spams si vous ne recevez pas l\'email' : isRegister ? 'Votre nom de famille sera utilisé comme nom de foyer' : 'Créez un compte pour commencer à gérer vos finances'}
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
