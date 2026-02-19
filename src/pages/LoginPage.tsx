import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CURRENCIES, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '@/types/finance';
import logo from '@/assets/logo.png';

const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

        // If auto-confirmed, create household immediately
        if (signUpData.session) {
          await createHousehold(signUpData.session.user.id, lastName, currency);
          toast.success('Bienvenue sur FineHome ! 🎉');
        } else {
          toast.success('Vérifiez votre email pour confirmer votre compte !');
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
        toast.success('Connexion réussie !');
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
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="thomas@finehome.app" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? '...' : (isRegister ? "Créer mon compte" : "Se connecter")}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {isRegister ? 'Votre nom de famille sera utilisé comme nom de foyer' : 'Créez un compte pour commencer à gérer vos finances'}
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
