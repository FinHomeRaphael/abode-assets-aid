import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatDateLong } from '@/utils/format';
import { getInitials } from '@/utils/format';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

const Profile = () => {
  const { household, currentUser, logout, resetDemo } = useApp();

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6">⚙️ Profil & Foyer</h1>

        {/* Household info */}
        <div className="bg-card border border-border rounded-lg p-5 mb-4">
          <h2 className="font-semibold mb-3">🏠 {household.name}</h2>
          <p className="text-sm text-muted-foreground">Créé le {formatDateLong(household.createdAt)}</p>
          <p className="text-sm text-muted-foreground">Devise : {household.currency}</p>
        </div>

        {/* Members */}
        <div className="bg-card border border-border rounded-lg p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Membres</h2>
            <button className="text-sm text-primary hover:underline" onClick={() => toast.info('Fonctionnalité à venir')}>+ Inviter</button>
          </div>
          <div className="space-y-3">
            {household.members.map(m => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
                    {getInitials(m.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.name} {m.id === currentUser?.id && <span className="text-xs text-muted-foreground">(vous)</span>}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  {m.role === 'admin' ? 'Admin' : 'Membre'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="bg-card border border-border rounded-lg p-5 mb-4 space-y-3">
          <h2 className="font-semibold">Paramètres</h2>
          <div className="flex items-center justify-between text-sm">
            <span>Devise par défaut</span>
            <span className="font-medium">{household.currency}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Notifications</span>
            <span className="text-success font-medium">Activées</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => { toast.info('Export en cours...'); setTimeout(() => toast.success('Données exportées ✓'), 1500); }}
            className="w-full py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            📁 Exporter mes données
          </button>
          <button
            onClick={resetDemo}
            className="w-full py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            🔄 Réinitialiser les données de démo
          </button>
          <button
            onClick={logout}
            className="w-full py-2.5 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Déconnexion
          </button>
        </div>
      </motion.div>
    </Layout>
  );
};

export default Profile;
