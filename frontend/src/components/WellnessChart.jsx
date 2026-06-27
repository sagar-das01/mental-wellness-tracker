import React from 'react';

export default function WellnessChart({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
        Not enough logs to render charts yet.
      </div>
    );
  }

  // Take up to last 7 logs and reverse for chronological order (left-to-right)
  const chartData = [...logs].slice(0, 7).reverse();

  const width = 500;
  const height = 180;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const pointsCount = chartData.length;
  const stepX = pointsCount > 1 ? chartWidth / (pointsCount - 1) : chartWidth;

  // Helper to map values to SVG coordinates
  // Mood ranges from 1 to 5
  const getMoodY = (val) => {
    const ratio = (val - 1) / 4; // 0 to 1
    return height - paddingBottom - ratio * chartHeight;
  };

  // Sleep ranges from 0 to 12 (max cap)
  const getSleepY = (val) => {
    const maxSleep = 12;
    const ratio = Math.min(val, maxSleep) / maxSleep;
    return height - paddingBottom - ratio * chartHeight;
  };

  // Generate path for Mood Line
  let moodPath = '';
  chartData.forEach((d, idx) => {
    const x = paddingLeft + idx * stepX;
    const y = getMoodY(d.mood);
    if (idx === 0) {
      moodPath += `M ${x} ${y}`;
    } else {
      moodPath += ` L ${x} ${y}`;
    }
  });

  // Generate area under Mood Line
  let moodAreaPath = '';
  if (chartData.length > 0) {
    const startX = paddingLeft;
    const endX = paddingLeft + (chartData.length - 1) * stepX;
    const bottomY = height - paddingBottom;
    moodAreaPath = `${moodPath} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
  }

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
      <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '16px' }}>
        📊 Weekly Mood & Sleep Trends
      </h3>

      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <defs>
            <linearGradient id="moodAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="moodLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[1, 2, 3, 4, 5].map((level) => {
            const y = getMoodY(level);
            return (
              <line
                key={level}
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="1"
              />
            );
          })}

          {/* X Axis Labels */}
          {chartData.map((d, idx) => {
            const x = paddingLeft + idx * stepX;
            const date = new Date(d.created_at);
            const label = date.toLocaleDateString(undefined, { weekday: 'short' });
            return (
              <text
                key={d.id}
                x={x}
                y={height - 8}
                fill="var(--text-muted)"
                fontSize="9"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}

          {/* Y Axis Labels (Mood) */}
          {[1, 3, 5].map((level) => {
            const y = getMoodY(level);
            return (
              <text
                key={level}
                x={paddingLeft - 8}
                y={y + 3}
                fill="var(--text-muted)"
                fontSize="9"
                textAnchor="end"
              >
                {level === 1 ? '😢' : level === 3 ? '😐' : '😊'}
              </text>
            );
          })}

          {/* Sleep Bars (rendered in background) */}
          {chartData.map((d, idx) => {
            const x = paddingLeft + idx * stepX;
            const barWidth = 10;
            const y = getSleepY(d.sleep_hours);
            const barHeight = Math.max(0, height - paddingBottom - y);
            return (
              <rect
                key={`sleep-${d.id}`}
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="rgba(6, 182, 212, 0.25)"
                rx="2"
              />
            );
          })}

          {/* Mood Line Area */}
          {chartData.length > 1 && (
            <path d={moodAreaPath} fill="url(#moodAreaGrad)" />
          )}

          {/* Mood Line */}
          {chartData.length > 1 && (
            <path
              d={moodPath}
              fill="none"
              stroke="url(#moodLineGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points circles */}
          {chartData.map((d, idx) => {
            const x = paddingLeft + idx * stepX;
            const y = getMoodY(d.mood);
            return (
              <circle
                key={`point-${d.id}`}
                cx={x}
                cy={y}
                r="4.5"
                fill="#ffffff"
                stroke="#8b5cf6"
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>

      {/* Chart Legend */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '12px', fontSize: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '3px', background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)', borderRadius: '2px' }}></span>
          <span style={{ color: 'var(--text-secondary)' }}>Mood Index (1-5)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', background: 'rgba(6, 182, 212, 0.25)', border: '1px solid rgba(6, 182, 212, 0.5)', borderRadius: '2px' }}></span>
          <span style={{ color: 'var(--text-secondary)' }}>Sleep Hours (0-12h)</span>
        </div>
      </div>
    </div>
  );
}
