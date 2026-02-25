import React from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import HealthScoreGauge from '@/components/HealthScoreGauge';
import HealthScoreDetail from '@/components/HealthScoreDetail';
import HealthScoreHistory from '@/components/HealthScoreHistory';
import { useHealthScore, useSaveHealthScore, useHealthScoreHistory } from '@/hooks/useHealthScore';
import { useApp } from '@/context/AppContext';

const HealthScorePage: React.FC = () => {
  const { householdId } = useApp();

  const healthScore = useHealthScore();
  useSaveHealthScore(healthScore.totalScore, householdId);
  const history = useHealthScoreHistory(householdId);

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
