/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Navy surface scale
        navy: {
          950: '#04060B',
          900: '#0B1220',
          800: '#0E1626',
          700: '#152134',
          600: '#1E2A3D',
          500: '#2A3A52',
          400: '#3C4E6A',
          300: '#5A6B84',
          200: '#97A6BC',
          100: '#C7D2E1',
          50: '#F0F4FA',
        },
        // Brand
        teal: {
          400: '#3DD5C6',
          500: '#16C0AE', // action
          700: '#0B7A6F',
        },
        amber: {
          400: '#FBBF3B',
          500: '#F4A521', // alert
          600: '#D0860C',
        },
        // Semantic status
        online: '#3FD07E',
        offline: '#64748B',
        'in-progress': '#3B82F6',
        blocked: '#F04438',
        approved: '#22C55E',
        rejected: '#E5484D',
        // Designation categories (hue per category, shade per role)
        engineering: {
          swe: '#7DB0FF',
          'sr-swe': '#4C8DFF',
          lead: '#2E6BF0',
          backend: '#1D4ED8',
          frontend: '#4338CA',
          mobile: '#6D5DF0',
        },
        quality: {
          qa: '#C084FC',
          'sr-qa': '#A855F7',
          uiux: '#7E22CE',
        },
        delivery: {
          pm: '#FCD34D',
          mgr: '#F59E0B',
          product: '#D97706',
          ba: '#B45309',
        },
        operations: {
          devops: '#22D3EE',
          'hr-ops': '#06B6D4',
          admin: '#0E7490',
        },
        business: {
          sales: '#FB7185',
          leadership: '#E11D48',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Type scale from the design system
        display: ['44px', { lineHeight: '1.05', fontWeight: '600' }],
        h1: ['30px', { lineHeight: '1.15', fontWeight: '600' }],
        h2: ['22px', { lineHeight: '1.2', fontWeight: '600' }],
        h3: ['17px', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.5' }],
        caption: ['11px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        // Sharp corners: 2px default across the product
        DEFAULT: '2px',
        sm: '2px',
        md: '2px',
        lg: '4px',
      },
      borderColor: {
        // 1px hairline default
        DEFAULT: '#1E2A3D',
      },
    },
  },
  plugins: [],
}
