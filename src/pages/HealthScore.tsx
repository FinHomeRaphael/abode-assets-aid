import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import HealthScoreGauge from '@/components/HealthScoreGauge';
import HealthScoreDetail from '@/components/HealthScoreDetail';
import HealthScoreHistory from '@/components/HealthScoreHistory';
import { useHealthScore, useSaveHealthScore, useHealthScoreHistory } from '@/hooks/useHealthScore';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';
import { useExchangeRates } from '@/hooks/useExchangeRates';

// European median net worth per household (~205,000€, INSEE 2024)
const EU_MEDIAN_PATRIMONY = 205000;

const HealthScorePage: React.FC = () => {
  const { householdId, scopedAccounts: accounts, getAccountBalance, household, financeScope, session } = useApp();
  const { formatAmount } = useCurrency();
  const { convert } = useExchangeRates(household.currency);

  const healthScore = useHealthScore();
  useSaveHealthScore(healthScore.totalScore, householdId);
  const history = useHealthScoreHistory(householdId);

  // Fetch property values from debts
  const [propertyValues, setPropertyValues] = useState<{ value: number; currency: string }[]>([]);

  useEffect(() => {
    if (!householdId) return;
    const userId = session?.user?.id;
    let query = supabase.from('debts').select('property_value, currency');
    if (financeScope === 'personal') {
      query = query.eq('scope', 'personal').eq('created_by', userId);
    } else {
      query = query.eq('household_id', householdId).eq('scope', 'household');
    }
    query.not('property_value', 'is', null).then(({ data }) => {
      if (data) {
        setPropertyValues(data.filter(d => d.property_value).map(d => ({
          value: Number(d.property_value),
          currency: d.currency,
        })));
      }
    });
  }, [householdId, financeScope, session?.user?.id]);

  const totalAssets = useMemo(() => {
    const activeAccounts = accounts.filter(a => !a.isArchived);
    const accountsTotal = activeAccounts.reduce((s, a) => {
      const bal = getAccountBalance(a.id);
      return s + (a.currency !== household.currency ? convert(bal, a.currency) : bal);
    }, 0);
    const propertyTotal = propertyValues.reduce((s, p) => {
      return s + (p.currency !== household.currency ? convert(p.value, p.currency) : p.value);
    }, 0);
    return { accountsTotal, propertyTotal, total: accountsTotal + propertyTotal };
  }, [accounts, getAccountBalance, propertyValues, household.currency, convert]);

  // Comparison with EU median
  const euComparison = useMemo(() => {
    const total = totalAssets.total;
    const medianInUserCurrency = household.currency !== 'EUR' ? convert(EU_MEDIAN_PATRIMONY, 'EUR') : EU_MEDIAN_PATRIMONY;
    const pct = medianInUserCurrency > 0 ? (total / medianInUserCurrency) * 100 : 0;
    let label: string;
    let emoji: string;
    if (pct >= 200) { label = 'Bien au-dessus'; emoji = '🏆'; }
    else if (pct >= 120) { label = 'Au-dessus'; emoji = '✨'; }
    else if (pct >= 80) { label = 'Dans la moyenne'; emoji = '👍'; }
    else if (pct >= 50) { label = 'En-dessous'; emoji = '📈'; }
    else { label = 'Bien en-dessous'; emoji = '💪'; }
    return { pct: Math.round(pct), label, emoji, medianInUserCurrency };
  }, [totalAssets.total, household.currency, convert]);

  const fade = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

  return (
    <Layout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={fade}>
          <h1 className="text-lg font-semibold">🏥 Santé Financière</h1>
          <p className="text-xs text-muted-foreground">Ton score global basé sur tes finances</p>
        </motion.div>

        <motion.div variants={fade} className="bg-card border border-border rounded-2xl p-6 flex justify-center">
          <HealthScoreGauge
            score={healthScore.totalScore}
            label={healthScore.label}
            color={healthScore.color}
            diff={healthScore.diff}
          />
        </motion.div>

        {/* Total Assets Card */}
        <motion.div variants={fade} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold">🏛️ Patrimoine total</h3>
          <div className="text-center">
            <p className="text-2xl font-bold font-mono-amount tracking-tight">
              {formatAmount(totalAssets.total)}
            </p>
            <div className="flex justify-center gap-4 mt-2 text-[11px] text-muted-foreground">
              <span>🏦 Comptes : {formatAmount(totalAssets.accountsTotal)}</span>
              {totalAssets.propertyTotal > 0 && (
                <span>🏠 Immobilier : {formatAmount(totalAssets.propertyTotal)}</span>
              )}
            </div>
          </div>

          {/* EU comparison */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">vs. médiane européenne</span>
              <span className="font-medium">{euComparison.emoji} {euComparison.label}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden relative">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(euComparison.pct, 100)}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
              <span className="font-mono-amount">{euComparison.pct}% de la médiane</span>
              <span className="font-mono-amount">Médiane : {formatAmount(euComparison.medianInUserCurrency)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1 italic">
              Source : INSEE 2024 – Patrimoine brut médian des ménages européens
            </p>
          </div>
        </motion.div>

        <motion.div variants={fade}>
          <HealthScoreDetail criteria={healthScore.criteria} tips={healthScore.tips} />
        </motion.div>

        <motion.div variants={fade}>
          <HealthScoreHistory history={history} />
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default HealthScorePage;
