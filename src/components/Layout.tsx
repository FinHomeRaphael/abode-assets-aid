import React, { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { getInitials } from '@/utils/format';
import AddTransactionModal from '@/components/AddTransactionModal';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Vue d\'ensemble', emoji: '📊' },
  { path: '/transactions', label: 'Transactions', emoji: '💳' },
  { path: '/budgets', label: 'Budgets', emoji: '🎯' },
  { path: '/savings', label: 'Épargne', emoji: '🐷' },
];

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { household, currentUser } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="container max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/')} className="text-lg font-bold flex items-center gap-1.5">
              🏠 <span>FineHome</span>
            </button>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <span className="mr-1.5">{item.emoji}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1">
              {household.members.map(m => (
                <div key={m.id} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground" title={m.name}>
                  {getInitials(m.name)}
                </div>
              ))}
            </div>
            <button onClick={() => setShowAddModal(true)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              + Ajouter
            </button>
            <button onClick={() => navigate('/profile')} className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {currentUser ? getInitials(currentUser.name) : '?'}
            </button>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-md border-t border-border">
        <div className="flex justify-around py-2">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 text-xs ${
                location.pathname === item.path ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="text-lg">{item.emoji}</span>
              <span>{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="container max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>

      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};

export default Layout;
