import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Veuillez remplir tous les champs'); return; }
    if (isRegister && !firstName) { toast.error('Veuillez entrer votre prénom'); return; }

    setIsLoading(true);
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName } },
        });
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Cet email est déjà utilisé');
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success('Vérifiez votre email pour confirmer votre compte !');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-4">F</div>
          <h1 className="text-2xl font-bold mb-1">FineHome</h1>
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
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label className="block text-sm font-medium mb-1.5">Prénom</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Thomas" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
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

        <p className="text-center text-xs text-muted-foreground mt-6">Créez un compte pour commencer à gérer vos finances</p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
