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
import { Home, CreditCard, Target, PiggyBank, Landmark, Lightbulb, Plus, Camera, Sparkles, X } from 'lucide-react';
import ScopeToggle from '@/components/ScopeToggle';

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
      <header className="hidden md:block sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
              <img src={logoSquare} alt="FinHome" className="w-full h-full object-cover" />
            </button>
            <nav className="flex items-center gap-0.5">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ScopeToggle />
            <button onClick={() => setShowAddModal(true)} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
            <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-xl bg-secondary/50 border border-border/30 flex items-center justify-center text-xs font-bold text-muted-foreground hover:bg-secondary transition-colors">
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
            className="md:hidden fixed inset-0 z-40 bg-foreground/30 backdrop-blur-md"
            onClick={() => setFabOpen(false)}
          >
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" onClick={e => e.stopPropagation()}>
              {fabActions.map((item, i) => (
                <motion.button
                  key={item.action}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.8 }}
                  transition={{ delay: i * 0.04, type: 'spring', damping: 20, stiffness: 300 }}
                  onClick={() => handleFabAction(item.action)}
                  className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-card/90 backdrop-blur-sm shadow-lg border border-border/30 active:scale-95 transition-transform"
                >
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/30 safe-area-bottom">
        <div className="flex justify-around items-center py-1.5 px-1">
          {navItems.slice(0, 3).map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className={`text-[9px] font-medium ${isActive ? 'text-primary' : ''}`}>{item.label}</span>
              </button>
            );
          })}

          {/* FAB center button */}
          <div className="relative -mt-6">
            <button
              onClick={() => setFabOpen(prev => !prev)}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-[0_4px_16px_-2px_hsl(var(--primary)/0.5)] flex items-center justify-center active:scale-90 transition-all"
            >
              <motion.div
                animate={{ rotate: fabOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <Plus className="w-6 h-6 text-primary-foreground" />
              </motion.div>
            </button>
          </div>

          {navItems.slice(3).map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className={`text-[9px] font-medium ${isActive ? 'text-primary' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="container max-w-5xl mx-auto px-4 md:px-6 py-5 pb-36 md:pb-8">
        <div className="md:hidden mb-4">
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
