/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens from the README
        bg:              '#07080a',
        surface:         '#0b0d0c',
        'surface-raised': '#0e110f',
        'surface-input': '#111413',
        'surface-hover':  '#0d100e',
        'card-hover':     '#101310',
        accent:          '#d6f43a',
        'accent-hover':   '#eaffa0',
        'accent-deep':    '#4b6b0d',
        'accent-dim':     '#c3d68a',
        'accent-cool':    '#7fd6ff',
        text:            '#e8ece8',
        'text-2':         '#c3c9c3',
        'text-3':         '#9aa39a',
        'text-4':         '#8d968d',
        'text-5':         '#7b837b',
        'text-6':         '#6f776f',
        'text-7':         '#5d655d',
        toggle:           { off: '#22261f' },
        knob:             { off: '#7b837b' },
        overlay:          '#040506',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        'tightest': '-0.035em',
        'tighter':  '-0.03em',
        'tight':    '-0.02em',
        'normal-tight': '-0.01em',
      },
      maxWidth: {
        'site': '1400px',
        'dash': '1260px',
      },
      keyframes: {
        orbSpin:  { 'from': { transform: 'rotate(0deg)' }, 'to': { transform: 'rotate(360deg)' } },
        floatY:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        pulseDot: { '0%,100%': { opacity: '.35', transform: 'scale(.85)' }, '50%': { opacity: '1', transform: 'scale(1.15)' } },
        rise:     { 'from': { opacity: '0', transform: 'translateY(18px)' }, 'to': { opacity: '1', transform: 'translateY(0)' } },
        ticker:   { 'from': { transform: 'translateX(0)' }, 'to': { transform: 'translateX(-50%)' } },
        growBar:  { 'from': { transform: 'scaleY(0)' }, 'to': { transform: 'scaleY(1)' } },
      },
      animation: {
        'orb-spin':   'orbSpin 26s linear infinite',
        'float-y':    'floatY 9s ease-in-out infinite',
        'pulse-dot':  'pulseDot 2.4s ease-in-out infinite',
        'rise':       'rise .28s ease both',
        'ticker':     'ticker 34s linear infinite',
        'grow-bar':   'growBar .7s cubic-bezier(.2,.7,.2,1) both',
      },
      boxShadow: {
        'btn-primary':   '0 12px 44px rgba(214,244,58,.24)',
        'btn-nav':       '0 0 0 1px rgba(214,244,58,.4), 0 8px 30px rgba(214,244,58,.18)',
        'modal':         '0 40px 120px rgba(0,0,0,.7)',
        'logo-sphere':   '0 0 22px rgba(214,244,58,.45)',
        'routing-sphere':'0 0 120px rgba(214,244,58,.18), inset 0 0 80px rgba(0,0,0,.6)',
      },
      backgroundImage: {
        'hero-radial': 'radial-gradient(120% 80% at 70% -10%, #10160f 0%, #07080a 55%, #07080a 100%)',
        'logo-sphere': 'radial-gradient(circle at 32% 28%, #eaffa0, #d6f43a 45%, #4b6b0d 100%)',
      },
    },
  },
  plugins: [],
};
