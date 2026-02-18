import React, { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { getInitials } from '@/utils/format';
import AddTransactionModal from '@/components/AddTransactionModal';
import ScanTicketModal from '@/components/ScanTicketModal';
import AddBudgetModal from '@/components/AddBudgetModal';
import AddSavingsGoalModal from '@/components/AddSavingsGoalModal';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Accueil', emoji: '🏠' },
  { path: '/transactions', label: 'Transactions', emoji: '💳' },
  { path: '/budgets', label: 'Budgets', emoji: '🎯' },
  { path: '/savings', label: 'Enveloppes', emoji: '🐷' },
  { path: '/debts', label: 'Dettes', emoji: '🏦' },
  { path: '/insights', label: 'Insights', emoji: '💡' },
];

const fabActions = [
  { label: 'Transaction', emoji: '💳', action: 'transaction' },
  { label: 'Scanner un ticket', emoji: '📸', action: 'scan' },
  { label: 'Budget', emoji: '🎯', action: 'budget' },
  { label: 'Enveloppe', emoji: '🐷', action: 'savings' },
  { label: 'Compte', emoji: '🏦', action: 'account' },
  { label: 'Conseiller IA', emoji: '✨', action: 'chat' },
];

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { household, currentUser } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const handleFabAction = (action: string) => {
    setFabOpen(false);
    if (action === 'transaction') setShowAddModal(true);
    else if (action === 'scan') setShowScanModal(true);
    else if (action === 'budget') setShowBudgetModal(true);
    else if (action === 'savings') setShowSavingsModal(true);
    else if (action === 'chat') navigate('/chat');
    else if (action === 'account') navigate('/savings?create=account');
  };

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

      {/* FAB overlay */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setFabOpen(false)}
          >
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
              {fabActions.map((item, i) => (
                <motion.button
                  key={item.action}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.8 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  onClick={() => handleFabAction(item.action)}
                  className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card shadow-lg border border-border/50 active:scale-95 transition-transform"
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 safe-area-bottom">
        <div className="flex justify-around items-center py-2 px-1">
          {navItems.slice(0, 3).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all min-w-0 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className={`text-lg ${isActive ? 'scale-110' : ''} transition-transform`}>{item.emoji}</span>
                <span className={`text-[9px] font-medium truncate ${isActive ? 'text-primary' : ''}`}>{item.label}</span>
              </button>
            );
          })}

          {/* FAB center button */}
          <div className="relative -mt-7">
            <button
              onClick={() => setFabOpen(prev => !prev)}
              className="w-14 h-14 rounded-full bg-primary shadow-[0_4px_16px_-2px_hsl(var(--primary)/0.5)] flex items-center justify-center active:scale-90 transition-all"
            >
              <motion.span
                animate={{ rotate: fabOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-primary-foreground text-3xl font-light leading-none flex items-center justify-center w-full h-full"
              >
                +
              </motion.span>
            </button>
          </div>

          {navItems.slice(3).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all min-w-0 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className={`text-lg ${isActive ? 'scale-110' : ''} transition-transform`}>{item.emoji}</span>
                <span className={`text-[9px] font-medium truncate ${isActive ? 'text-primary' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="container max-w-5xl mx-auto px-4 md:px-6 py-6 pb-36 md:pb-8">
        {children}
      </main>

      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <ScanTicketModal open={showScanModal} onClose={() => setShowScanModal(false)} />
      <AddBudgetModal open={showBudgetModal} onClose={() => setShowBudgetModal(false)} />
      <AddSavingsGoalModal open={showSavingsModal} onClose={() => setShowSavingsModal(false)} />
    </div>
  );
};

export default Layout;