import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface HealthScoreGaugeProps {
  score: number;
  label: string;
  color: string;
  diff: number | null;
  compact?: boolean;
}

const HealthScoreGauge: React.FC<HealthScoreGaugeProps> = ({ score, label, color, diff, compact = false }) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  const size = compact ? 180 : 240;
  const strokeWidth = compact ? 16 : 20;
  const radius = (size / 2) - strokeWidth;
  const circumference = Math.PI * radius;
  const fillLength = (animatedScore / 100) * circumference;

  const cx = size / 2;
  const cy = size / 2;

  // Arc: starts from left (180deg) to right (0deg) → half circle top
  const startX = cx - radius;
  const startY = cy;
  const endX = cx + radius;
  const endY = cy;

  const arcPath = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
            <stop offset="25%" stopColor="hsl(38, 92%, 50%)" />
            <stop offset="50%" stopColor="hsl(48, 96%, 53%)" />
            <stop offset="75%" stopColor="hsl(160, 84%, 39%)" />
            <stop offset="100%" stopColor="hsl(160, 84%, 29%)" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d={arcPath}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Filled arc */}
        <path
          d={arcPath}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      <div className={`flex flex-col items-center ${compact ? '-mt-10' : '-mt-14'}`}>
        <motion.span
          className={`font-bold font-mono-amount ${compact ? 'text-3xl' : 'text-5xl'}`}
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          {animatedScore}
        </motion.span>
        <span className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'} mt-0.5`}>
          {label} santé
        </span>
        {diff !== null && (
          <span className={`text-xs mt-1 px-2 py-0.5 rounded-full ${
            diff >= 0
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}>
            {diff >= 0 ? '📈' : '📉'} {diff >= 0 ? '+' : ''}{diff} pts ce mois
          </span>
        )}
      </div>
    </div>
  );
};

export default HealthScoreGauge;
