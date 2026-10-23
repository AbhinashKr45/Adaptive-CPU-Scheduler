import React, { useState } from 'react';
import { TraceIntervalItem } from '../types';

interface GanttChartProps {
  trace: TraceIntervalItem[];
  makespan: number;
}

const PROCESS_COLORS = [
  '#2563eb', // Blue
  '#ea580c', // Orange
  '#16a34a', // Green
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#d97706', // Amber
  '#db2777', // Pink
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#dc2626'  // Red
];

export const GanttChart: React.FC<GanttChartProps> = ({ trace, makespan }) => {
  const [hoveredInterval, setHoveredInterval] = useState<TraceIntervalItem | null>(null);

  if (!trace || trace.length === 0 || makespan <= 0) {
    return (
      <div className="empty-state">
        <p>No execution trace available to render.</p>
      </div>
    );
  }

  // Get unique PIDs for legend
  const uniquePids = Array.from(new Set(trace.filter(t => !t.is_idle).map(t => t.pid))).sort((a, b) => a - b);

  const getProcessColor = (pid: number) => {
    return PROCESS_COLORS[(pid - 1) % PROCESS_COLORS.length] || '#475569';
  };

  // Generate milestone ticks along makespan
  const tickCount = Math.min(15, makespan);
  const tickStep = Math.max(1, Math.round(makespan / tickCount));
  const ticks = [];
  for (let t = 0; t <= makespan; t += tickStep) {
    ticks.push(t);
  }
  if (ticks[ticks.length - 1] !== makespan) {
    ticks.push(makespan);
  }

  return (
    <div className="gantt-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-700)' }}>
          CPU Execution Timeline (Intervals: {trace.length}, Makespan: {makespan} units)
        </div>
        {hoveredInterval && (
          <div style={{ fontSize: '0.8rem', background: 'var(--surface-secondary)', padding: '2px 8px', borderRadius: 4 }}>
            {hoveredInterval.is_idle ? (
              <span><strong>CPU Idle:</strong> [{hoveredInterval.start_time} → {hoveredInterval.end_time}] ({hoveredInterval.end_time - hoveredInterval.start_time} units)</span>
            ) : (
              <span><strong>PID {hoveredInterval.pid}:</strong> [{hoveredInterval.start_time} → {hoveredInterval.end_time}] ({hoveredInterval.end_time - hoveredInterval.start_time} units)</span>
            )}
          </div>
        )}
      </div>

      {/* Main Gantt Bar */}
      <div className="gantt-bar-container">
        {trace.map((interval, idx) => {
          const duration = interval.end_time - interval.start_time;
          const widthPct = (duration / makespan) * 100;
          const isIdle = interval.is_idle || interval.pid === -1;
          const bgColor = isIdle ? undefined : getProcessColor(interval.pid);

          return (
            <div
              key={idx}
              className={`gantt-segment ${isIdle ? 'idle' : ''}`}
              style={{
                width: `${widthPct}%`,
                backgroundColor: bgColor
              }}
              onMouseEnter={() => setHoveredInterval(interval)}
              onMouseLeave={() => setHoveredInterval(null)}
              title={isIdle ? `CPU Idle: [${interval.start_time} - ${interval.end_time}]` : `P${interval.pid}: [${interval.start_time} - ${interval.end_time}]`}
            >
              {widthPct > 3 ? (isIdle ? 'Idle' : `P${interval.pid}`) : ''}
            </div>
          );
        })}
      </div>

      {/* Timeline Ticks Axis */}
      <div className="gantt-timeline-ticks">
        {ticks.map((t, idx) => {
          const leftPct = (t / makespan) * 100;
          return (
            <div key={idx} className="tick-mark" style={{ left: `${leftPct}%` }}>
              | {t}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14, fontSize: '0.75rem' }}>
        {uniquePids.map(pid => (
          <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: getProcessColor(pid) }} />
            <span>Process P{pid}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 3px, #94a3b8 3px, #94a3b8 6px)' }} />
          <span>CPU Idle</span>
        </div>
      </div>
    </div>
  );
};
