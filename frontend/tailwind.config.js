/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#1A1310',
          900: '#241A15',
          800: '#33241C',
        },
        ember: {
          50: '#FFF3EC',
          100: '#FFE2D0',
          200: '#FFC29B',
          300: '#FF9D63',
          400: '#F97431',
          500: '#E8491D',
          600: '#C93714',
          700: '#A32B10',
        },
        marigold: {
          400: '#F7B733',
          500: '#F0A500',
        },
        cream: {
          50: '#FFFDFA',
          100: '#FBF5EC',
          200: '#F3E8D8',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 10px rgba(26,19,16,0.06)',
        lift: '0 12px 30px rgba(26,19,16,0.14)',
      },
    },
  },
  plugins: [],
}
