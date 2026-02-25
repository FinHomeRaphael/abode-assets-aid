import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface HealthScoreHistoryProps {
  history: { monthYear: string; score: number }[];
}

const monthLabels: Record<string, string> = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aoû',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

function formatMonthLabel(monthYear: string): string {
  const parts = monthYear.split('-');
  return monthLabels[parts[1]] || parts[1];
}

const HealthScoreHistory: React.FC<HealthScoreHistoryProps> = ({ history }) => {
  if (history.length < 2) return null;

  const data = history.map(h => ({
    name: formatMonthLabel(h.monthYear),
    score: h.score,
  }));

  const firstScore = history[0].score;
  const lastScore = history[history.length - 1].score;
  const totalGain = lastScore - firstScore;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">📈 Évolution sur {history.length} mois</h3>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value} pts`, 'Score']}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#scoreGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {totalGain !== 0 && (
        <p className="text-xs text-center mt-2 text-muted-foreground">
          {totalGain > 0 ? '🎉' : '📉'} {totalGain > 0 ? '+' : ''}{totalGain} points sur {history.length} mois
        </p>
      )}
    </div>
  );
};

export default HealthScoreHistory;
