import React from 'react';
import { useApp } from '@/context/AppContext';
import { Home, User } from 'lucide-react';

const ScopeToggle = () => {
  const { financeScope, setFinanceScope } = useApp();

  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-0.5 gap-0.5">
      <button
        onClick={() => setFinanceScope('household')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          financeScope === 'household'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Foyer</span>
      </button>
      <button
        onClick={() => setFinanceScope('personal')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          financeScope === 'personal'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <User className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Perso</span>
      </button>
    </div>
  );
};

export default ScopeToggle;
