/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Teams — energetic, bold accent
        teams: {
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#bcdcff',
          300: '#8ec6ff',
          400: '#59a6ff',
          500: '#3285fc',
          600: '#1c66f1',
          700: '#1551e0',
          800: '#1843b5',
          900: '#193d8f',
          950: '#142656',
        },
        // Duo — romantic maroon / rose-gold
        duo: {
          50: '#fdf3f4',
          100: '#fce7e9',
          200: '#f9d2d7',
          300: '#f3b0ba',
          400: '#e98497',
          500: '#db5f77',
          600: '#c3445e',
          700: '#a3324b',
          800: '#7d2a3f',
          900: '#4c1a26',
          950: '#33101a',
        },
        gold: {
          50: '#fbf7ef',
          100: '#f6ecd6',
          200: '#ead7ad',
          300: '#dcbb7b',
          400: '#d0a054',
          500: '#c6883a',
          600: '#a96b2e',
          700: '#864f29',
          800: '#6f4029',
          900: '#5d3627',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease forwards',
        'fade-in-up': 'fade-in-up 0.5s ease forwards',
        'scale-in': 'scale-in 0.25s ease forwards',
        pulse_slow: 'pulse-slow 2.4s ease-in-out infinite',
        'heart-rise': 'heart-rise 4s ease-in forwards',
        shimmer: 'shimmer 2.5s linear infinite',
        marquee: 'marquee 18s linear infinite',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'fade-in-up': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: 0, transform: 'scale(0.96)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
        'pulse-slow': {
          '0%,100%': { opacity: 0.5, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.04)' },
        },
        'heart-rise': {
          '0%': { opacity: 0, transform: 'translateY(0) scale(0.6)' },
          '15%': { opacity: 1 },
          '100%': { opacity: 0, transform: 'translateY(-220px) scale(1.1) rotate(20deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
