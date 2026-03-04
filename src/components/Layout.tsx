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
import { Home, CreditCard, Target, PiggyBank, Landmark, Lightbulb, Plus, X, Lock, HelpCircle } from 'lucide-react';
import ScopeToggle from '@/components/ScopeToggle';
import { useSubscription } from '@/hooks/useSubscription';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Accueil', icon: Home },
  { path: '/transactions', label: 'Transactions', icon: CreditCard },
  { path: '/budgets', label: 'Budgets', icon: Target },
  { path: '/savings', label: 'Comptes bancaires', icon: PiggyBank },
  { path: '/debts', label: 'Dettes', icon: Landmark },
];

// Mobile nav: all 6 items, icon-only to fit
const mobileNavItems = [
  { path: '/', label: 'Accueil', icon: Home },
  { path: '/transactions', label: 'Transac.', icon: CreditCard },
  { path: '/budgets', label: 'Budgets', icon: Target },
  { path: '/savings', label: 'Comptes', icon: PiggyBank },
  { path: '/debts', label: 'Dettes', icon: Landmark },
  
];

const fabActions = [
  { label: 'Transaction', emoji: '💳', action: 'transaction' },
  { label: 'Scanner un ticket', emoji: '📸', action: 'scan' },
  { label: 'Budget', emoji: '🎯', action: 'budget' },
  { label: 'Compte épargne', emoji: '🐷', action: 'savings' },
  { label: 'Dette', emoji: '💸', action: 'debt' },
  { label: 'Compte', emoji: '🏦', action: 'account' },
  { label: 'Coach IA', emoji: '✨', action: 'chat' },
];

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { household, currentUser } = useApp();
  const { isPremium, loading: subLoading } = useSubscription();
  const showLock = !subLoading && !isPremium;
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
                    {showLock && (item.path === '/debts' || item.path === '/insights' || item.path === '/chat') && <Lock className="w-3 h-3 text-amber-500" />}
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
            <button onClick={() => navigate('/aide')} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Aide & Tutoriel">
              <HelpCircle className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/profile')} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors">
              {currentUser ? getInitials(currentUser.name) : '?'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
        <div className="flex items-center h-[60px] px-2">
          {mobileNavItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all relative ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon className={`w-[18px] h-[18px] transition-transform ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span className={`text-[9px] font-medium leading-tight ${isActive ? 'text-primary' : ''}`}>{item.label}</span>
                {showLock && (item.path === '/debts' || item.path === '/insights' || item.path === '/chat') && <Lock className="w-2.5 h-2.5 text-amber-500 absolute top-0.5 right-1.5" />}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 lg:px-6 py-4 pb-24 lg:pb-8">
        <div className="lg:hidden mb-3 flex items-center justify-between">
          <ScopeToggle />
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate('/aide')} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Aide">
              <HelpCircle className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/profile')} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors">
              {currentUser ? getInitials(currentUser.name) : '?'}
            </button>
          </div>
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
