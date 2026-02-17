import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

const LoginPage = () => {
  const { login } = useApp();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Veuillez remplir tous les champs'); return; }
    if (isRegister && !firstName) { toast.error('Veuillez entrer votre prénom'); return; }
    login(email);
    toast.success(isRegister ? 'Compte créé avec succès !' : 'Connexion réussie !');
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
            <button type="submit" className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm">
              {isRegister ? "Créer mon compte" : "Se connecter"}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">ou continuer avec</span></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Google</button>
              <button className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Apple</button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">Démo : utilisez n'importe quel email pour accéder</p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
