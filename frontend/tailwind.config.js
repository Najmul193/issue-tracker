import colors from 'tailwindcss/colors';
import { brand, status, priority, orgType, notificationType, issueType } from './src/theme/palette.js';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand,
        status,
        priority,
        orgType,
        notificationType,
        issueType,
        neutral: colors.slate,
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 4px 12px -2px rgb(15 23 42 / 0.05)',
        'card-hover': '0 4px 10px -2px rgb(15 23 42 / 0.08), 0 12px 24px -8px rgb(15 23 42 / 0.10)',
        popover: '0 10px 30px -6px rgb(15 23 42 / 0.18), 0 4px 10px -4px rgb(15 23 42 / 0.10)',
        modal: '0 20px 50px -12px rgb(15 23 42 / 0.35)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
};
