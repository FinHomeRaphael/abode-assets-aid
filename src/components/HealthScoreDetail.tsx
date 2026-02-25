import React from 'react';
import { motion } from 'framer-motion';

interface CriterionResult {
  key: string;
  label: string;
  emoji: string;
  score: number;
  maxScore: number;
  description: string;
}

interface HealthScoreDetailProps {
  criteria: CriterionResult[];
  tips: { emoji: string; title: string; text: string }[];
}

const HealthScoreDetail: React.FC<HealthScoreDetailProps> = ({ criteria, tips }) => {
  return (
    <div className="space-y-4">
      {/* Criteria breakdown */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">📊 Détail du score</h3>
        <div className="space-y-3">
          {criteria.map((c, i) => {
            const pct = c.maxScore > 0 ? (c.score / c.maxScore) * 100 : 0;
            return (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{c.emoji} {c.label}</span>
                  <span className="font-mono-amount text-muted-foreground">{c.score}/{c.maxScore}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: pct >= 80 ? 'hsl(var(--success))' : pct >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.1 * i }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Tips */}
      {tips.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">💡 Conseils pour améliorer ton score</h3>
          <div className="space-y-3">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-base flex-shrink-0">{tip.emoji}</span>
                <div>
                  <p className="text-xs font-medium">{tip.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthScoreDetail;
