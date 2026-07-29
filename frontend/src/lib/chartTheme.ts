import type { CSSProperties } from 'react';
import { useTheme } from '../context/ThemeContext';
import { status, priority, issueType } from '../theme/palette.js';

export const STATUS_COLORS = status;
export const PRIORITY_COLORS = priority;
export const TYPE_COLORS = issueType;

export interface ChartTheme {
  gridColor: string;
  axisTick: { fontSize: number; fill: string };
  tooltipStyle: CSSProperties;
  tooltipLabelStyle: CSSProperties;
  legendStyle: CSSProperties;
  textMuted: string;
}

const LIGHT: ChartTheme = {
  gridColor: '#e5e7eb', // neutral-200
  axisTick: { fontSize: 11, fill: '#6b7280' }, // neutral-500
  tooltipStyle: {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    background: '#ffffff',
    boxShadow: '0 10px 30px -6px rgb(15 23 42 / 0.18)',
    fontSize: 12,
    padding: '8px 12px',
  },
  tooltipLabelStyle: { color: '#111827', fontWeight: 600 },
  legendStyle: { fontSize: 12, color: '#374151' },
  textMuted: '#6b7280',
};

const DARK: ChartTheme = {
  gridColor: '#334155', // slate-700
  axisTick: { fontSize: 11, fill: '#94a3b8' }, // slate-400
  tooltipStyle: {
    borderRadius: 12,
    border: '1px solid #334155',
    background: '#1e293b', // slate-800
    boxShadow: '0 10px 30px -6px rgb(0 0 0 / 0.5)',
    fontSize: 12,
    padding: '8px 12px',
  },
  tooltipLabelStyle: { color: '#f1f5f9', fontWeight: 600 },
  legendStyle: { fontSize: 12, color: '#cbd5e1' },
  textMuted: '#94a3b8',
};

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK : LIGHT;
}
