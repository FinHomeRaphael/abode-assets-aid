import React from 'react';
import {
  Home, ShoppingCart, Car, UtensilsCrossed, Gamepad2,
  ShoppingBag, Repeat, HeartPulse, Baby, GraduationCap,
  Plane, Gift, Receipt, Shield, PawPrint,
  Landmark, CreditCard, MoreHorizontal,
  Briefcase, Laptop, Award, Building, TrendingUp,
  Banknote, Clock, Heart, DollarSign, RotateCcw, Store,
  ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react';

const CATEGORY_ICON_MAP: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  // Expenses
  'Logement':          { icon: Home,             color: 'text-orange-600',  bg: 'bg-orange-100 dark:bg-orange-900/30' },
  'Alimentation':      { icon: ShoppingCart,     color: 'text-green-600',   bg: 'bg-green-100 dark:bg-green-900/30' },
  'Transport':         { icon: Car,              color: 'text-blue-600',    bg: 'bg-blue-100 dark:bg-blue-900/30' },
  'Restaurants':       { icon: UtensilsCrossed,  color: 'text-red-500',     bg: 'bg-red-100 dark:bg-red-900/30' },
  'Loisirs':           { icon: Gamepad2,         color: 'text-purple-600',  bg: 'bg-purple-100 dark:bg-purple-900/30' },
  'Shopping':          { icon: ShoppingBag,      color: 'text-pink-600',    bg: 'bg-pink-100 dark:bg-pink-900/30' },
  'Abonnements':       { icon: Repeat,           color: 'text-indigo-600',  bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  'Santé':             { icon: HeartPulse,       color: 'text-rose-600',    bg: 'bg-rose-100 dark:bg-rose-900/30' },
  'Famille & Enfants': { icon: Baby,             color: 'text-sky-600',     bg: 'bg-sky-100 dark:bg-sky-900/30' },
  'Éducation':         { icon: GraduationCap,    color: 'text-amber-600',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  'Voyages':           { icon: Plane,            color: 'text-teal-600',    bg: 'bg-teal-100 dark:bg-teal-900/30' },
  'Cadeaux':           { icon: Gift,             color: 'text-fuchsia-600', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30' },
  'Impôts & Taxes':    { icon: Receipt,          color: 'text-slate-600',   bg: 'bg-slate-100 dark:bg-slate-900/30' },
  'Assurances':        { icon: Shield,           color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  'Animaux':           { icon: PawPrint,         color: 'text-amber-700',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  'Frais bancaires':   { icon: Landmark,         color: 'text-gray-600',    bg: 'bg-gray-100 dark:bg-gray-900/30' },
  'Dettes':            { icon: CreditCard,       color: 'text-red-600',     bg: 'bg-red-100 dark:bg-red-900/30' },
  // Income
  'Salaire':           { icon: Briefcase,        color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  'Freelance':         { icon: Laptop,           color: 'text-violet-600',  bg: 'bg-violet-100 dark:bg-violet-900/30' },
  'Bonus / Prime':     { icon: Award,            color: 'text-amber-600',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  'Revenus locatifs':  { icon: Building,         color: 'text-orange-600',  bg: 'bg-orange-100 dark:bg-orange-900/30' },
  'Investissements':   { icon: TrendingUp,       color: 'text-green-600',   bg: 'bg-green-100 dark:bg-green-900/30' },
  'Allocations':       { icon: Banknote,         color: 'text-blue-600',    bg: 'bg-blue-100 dark:bg-blue-900/30' },
  'Pension / Retraite':{ icon: Clock,            color: 'text-slate-600',   bg: 'bg-slate-100 dark:bg-slate-900/30' },
  'Pension alimentaire':{ icon: Heart,           color: 'text-pink-600',    bg: 'bg-pink-100 dark:bg-pink-900/30' },
  'Cadeaux / Dons':    { icon: Gift,             color: 'text-fuchsia-600', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30' },
  'Remboursements':    { icon: RotateCcw,        color: 'text-teal-600',    bg: 'bg-teal-100 dark:bg-teal-900/30' },
  'Ventes':            { icon: Store,            color: 'text-indigo-600',  bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  // Transfers
  'Transfert':         { icon: ArrowLeftRight,   color: 'text-gray-500',    bg: 'bg-gray-100 dark:bg-gray-800/50' },
};

const DEFAULT_ICON = { icon: MoreHorizontal, color: 'text-muted-foreground', bg: 'bg-muted/50' };

export function getCategoryIcon(category: string) {
  return CATEGORY_ICON_MAP[category] || DEFAULT_ICON;
}

interface CategoryIconProps {
  category: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 'md', className = '' }) => {
  const { icon: Icon, color, bg } = getCategoryIcon(category);
  const sizeClasses = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`${sizeClasses} rounded-xl ${bg} flex items-center justify-center flex-shrink-0 ${className}`}>
      <Icon className={`${iconSize} ${color}`} />
    </div>
  );
};
