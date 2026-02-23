import React, { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import logoSquare from '@/assets/logo-square.png';
import { getInitials } from '@/utils/format';
import AddTransactionModal from '@/components/AddTransactionModal';
import ScanTicketModal from '@/components/ScanTicketModal';
import AddBudgetModal from '@/components/AddBudgetModal';
import AddSavingsGoalModal from '@/components/AddSavingsGoalModal';
import AddDebtModal from '@/components/AddDebtModal';
import { Home, CreditCard, Target, PiggyBank, Landmark, Lightbulb, Plus, X, Lock } from 'lucide-react';
import ScopeToggle from '@/components/ScopeToggle';
import { useSubscription } from '@/hooks/useSubscription';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Accueil', icon: Home },
  { path: '/transactions', label: 'Transactions', icon: CreditCard },
  { path: '/budgets', label: 'Budgets', icon: Target },
  { path: '/savings', label: 'Enveloppes', icon: PiggyBank },
  { path: '/debts', label: 'Dettes', icon: Landmark },
  { path: '/insights', label: 'Insights', icon: Lightbulb },
];

// Mobile nav: all 6 items, icon-only to fit
const mobileNavItems = [
  { path: '/', label: 'Accueil', icon: Home },
  { path: '/transactions', label: 'Transac.', icon: CreditCard },
  { path: '/budgets', label: 'Budgets', icon: Target },
  { path: '/savings', label: 'Envel.', icon: PiggyBank },
  { path: '/debts', label: 'Dettes', icon: Landmark },
  { path: '/insights', label: 'Insights', icon: Lightbulb },
];

const fabActions = [
  { label: 'Transaction', emoji: '💳', action: 'transaction' },
  { label: 'Scanner un ticket', emoji: '📸', action: 'scan' },
  { label: 'Budget', emoji: '🎯', action: 'budget' },
  { label: 'Enveloppe', emoji: '🐷', action: 'savings' },
  { label: 'Dette', emoji: '💸', action: 'debt' },
  { label: 'Compte', emoji: '🏦', action: 'account' },
  { label: 'Conseiller IA', emoji: '✨', action: 'chat' },
];

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { household, currentUser } = useApp();
  const { isPremium } = useSubscription();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const handleFabAction = (action: string) => {
    setFabOpen(false);
    if (action === 'transaction') setShowAddModal(true);
    else if (action === 'scan') setShowScanModal(true);
    else if (action === 'budget') setShowBudgetModal(true);
    else if (action === 'savings') setShowSavingsModal(true);
    else if (action === 'debt') setShowDebtModal(true);
    else if (action === 'chat') navigate('/chat');
    else if (action === 'account') navigate('/savings?create=account');
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Desktop header */}
      <header className="hidden lg:block sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => navigate('/')} className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
              <img src={logoSquare} alt="FinHome" className="w-full h-full object-cover" />
            </button>
            <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                    {!isPremium && (item.path === '/debts' || item.path === '/insights') && <Lock className="w-3 h-3 text-amber-500" />}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ScopeToggle />
            <button onClick={() => setShowAddModal(true)} className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
            <button onClick={() => navigate('/profile')} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors">
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
            transition={{ duration: 0.15 }}
            className="lg:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setFabOpen(false)}
          >
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5" onClick={e => e.stopPropagation()}>
              {fabActions.map((item, i) => (
                <motion.button
                  key={item.action}
                  initial={{ opacity: 0, y: 16, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.9 }}
                  transition={{ delay: i * 0.03, type: 'spring', damping: 25, stiffness: 350 }}
                  onClick={() => handleFabAction(item.action)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card shadow-card-lg border border-border active:scale-95 transition-transform"
                >
                  <span className="text-base">{item.emoji}</span>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-nav safe-area-bottom">
        <div className="flex items-center h-14 px-1">
          {mobileNavItems.slice(0, 3).map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                {!isPremium && (item.path === '/debts' || item.path === '/insights') && <Lock className="w-2.5 h-2.5 text-amber-500 absolute top-1 right-2" />}
              </button>
            );
          })}

          {/* FAB center button */}
          <div className="relative flex items-center justify-center w-14 flex-shrink-0">
            <button
              onClick={() => setFabOpen(prev => !prev)}
              className="w-11 h-11 -mt-5 rounded-full bg-primary shadow-md flex items-center justify-center active:scale-90 transition-transform"
            >
              <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ duration: 0.15 }}>
                <Plus className="w-5 h-5 text-primary-foreground" />
              </motion.div>
            </button>
          </div>

          {mobileNavItems.slice(3).map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                {!isPremium && (item.path === '/debts' || item.path === '/insights') && <Lock className="w-2.5 h-2.5 text-amber-500 absolute top-1 right-2" />}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 lg:px-6 py-4 pb-24 lg:pb-8">
        <div className="lg:hidden mb-3">
          <ScopeToggle />
        </div>
        {children}
      </main>

      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <ScanTicketModal open={showScanModal} onClose={() => setShowScanModal(false)} />
      <AddBudgetModal open={showBudgetModal} onClose={() => setShowBudgetModal(false)} />
      <AddSavingsGoalModal open={showSavingsModal} onClose={() => setShowSavingsModal(false)} />
      <AddDebtModal open={showDebtModal} onClose={() => setShowDebtModal(false)} onAdded={() => setShowDebtModal(false)} />
    </div>
  );
};

export default Layout;
