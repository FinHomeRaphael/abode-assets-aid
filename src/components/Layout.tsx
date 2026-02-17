import React, { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { getInitials } from '@/utils/format';
import AddTransactionModal from '@/components/AddTransactionModal';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Accueil', emoji: '🏠' },
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
      {/* Desktop header */}
      <header className="hidden md:block sticky top-0 z-30 glass border-b border-border/50">
        <div className="container max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button onClick={() => navigate('/')} className="text-lg font-bold flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-sm">F</span>
              <span>FineHome</span>
            </button>
            <nav className="flex items-center gap-1">
              {navItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === item.path
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
              + Ajouter
            </button>
            <button onClick={() => navigate('/profile')} className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-accent transition-colors">
              {currentUser ? getInitials(currentUser.name) : '?'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-border/50 safe-area-bottom">
        <div className="flex justify-around items-center py-2 px-2">
          {navItems.slice(0, 2).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform`}>{item.emoji}</span>
                <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : ''}`}>{item.label}</span>
              </button>
            );
          })}

          {/* FAB center button */}
          <div className="relative -mt-8">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-2xl font-light hover:bg-primary/90 active:scale-95 transition-all"
            >
              +
            </button>
          </div>

          {navItems.slice(2).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform`}>{item.emoji}</span>
                <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>


      <main className="container max-w-5xl mx-auto px-4 md:px-6 py-6 pb-36 md:pb-8">
        {children}
      </main>

      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};

export default Layout;
