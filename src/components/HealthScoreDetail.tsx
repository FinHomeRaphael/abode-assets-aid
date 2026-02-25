import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface CriterionResult {
  key: string;
  label: string;
  emoji: string;
  score: number;
  maxScore: number;
  description: string;
  details: { label: string; value: string }[];
  formula: string;
}

interface HealthScoreDetailProps {
  criteria: CriterionResult[];
  tips: { emoji: string; title: string; text: string }[];
}

const HealthScoreDetail: React.FC<HealthScoreDetailProps> = ({ criteria, tips }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (key: string) => setExpanded(prev => prev === key ? null : key);

  return (
    <div className="space-y-4">
      {/* Criteria breakdown */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">📊 Détail du score</h3>
        <div className="space-y-3">
          {criteria.map((c, i) => {
            const pct = c.maxScore > 0 ? (c.score / c.maxScore) * 100 : 0;
            const isOpen = expanded === c.key;
            return (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
              >
                <button
                  onClick={() => toggle(c.key)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{c.emoji} {c.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono-amount text-muted-foreground">{c.score}/{c.maxScore}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
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
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 ml-1 p-3 bg-muted/50 rounded-lg border border-border/50 space-y-2">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          📐 Formule : <span className="text-foreground">{c.formula}</span>
                        </p>
                        <div className="space-y-1">
                          {c.details.map((d, j) => (
                            <div key={j} className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">{d.label}</span>
                              <span className="font-mono-amount font-medium">{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
