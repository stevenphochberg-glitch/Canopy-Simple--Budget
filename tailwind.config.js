/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base neutrals, surfaces, cards, modals, and borders (strictly from columns 3 & 4 of reference palette)
        beige: {
          50: '#F6F0E4',  // Base app background (Col 3)
          100: '#F7FBEC', // Pale ivory card surface (Col 3)
          150: '#F7F9F4', // Crisp clean off-white (Col 4)
          200: '#E9E5D1', // Warm stone linen (Col 4)
          250: '#E8DBC8', // Soft warm beige (Col 4)
          300: '#E5E0CC', // Light stone beige (Col 4)
          400: '#E9E1CE', // Warm parchment beige (Col 3)
          500: '#D8C8AE', // Warm sand beige (Col 3)
          600: '#C2C7C1', // Soft sage-grey neutral border (Col 3)
          700: '#897253', // Taupe earth brown secondary text (Col 3)
          800: '#544A39', // Dark warm brown (Col 1)
          900: '#452A1F', // Deep espresso brown text (Col 4)
          950: '#19321C', // Deepest pine black text (Col 3)
        },
        // Muted sage & earth greens for savings, positive progress, and badges (from reference palette)
        sage: {
          50: '#F7FBEC',  // Col 3
          100: '#E5DFD3', // Col 1
          200: '#9ABF9B', // Col 1
          300: '#95A688', // Col 4
          400: '#93A887', // Col 4
          500: '#8CA07D', // Col 3
          600: '#778A65', // Col 2
          700: '#649F64', // Col 1
          800: '#425F4C', // Col 2
          900: '#31553C', // Col 4
          950: '#1F4A2C', // Col 3
        },
        // Dark forest green brand hierarchy (from reference palette)
        'dark-green': {
          50: '#F7F9F4',  // Col 4
          100: '#9ABF9B', // Col 1
          200: '#8CA07D', // Col 3
          300: '#778A65', // Col 2
          400: '#649F64', // Col 1
          500: '#425F4C', // Col 2
          600: '#31553C', // Col 4
          700: '#274D34', // Col 4
          800: '#1F4A2C', // Col 3 (Deep hunter evergreen)
          900: '#19321C', // Col 3 (Deepest dark pine)
          950: '#242C21', // Col 2 (Deepest forest black)
        },
        // Earth tones, tans, and warm accents (from reference palette)
        brown: {
          50: '#F6F0E4',  // Col 3
          100: '#E9E1CE', // Col 3
          200: '#E8DBC8', // Col 4
          300: '#D8C8AE', // Col 3
          400: '#DFCF93', // Col 2
          500: '#C1A96F', // Col 2
          600: '#A36644', // Col 1 (Terracotta)
          700: '#897253', // Col 3 (Taupe)
          800: '#544A39', // Col 1 (Dark olive brown)
          900: '#47422E', // Col 2 (Dark olive charcoal)
          950: '#452A1F', // Col 4 (Deep espresso)
        },
        // Muted Blues for Proration, Transferred, Informational tags & Rollover (from reference palette)
        'sky-blue': {
          50: '#F0F5F6',
          100: '#E2ECEE',
          200: '#C6DCDE',
          300: '#8BB2B9', // Col 3 (Muted slate blue)
          400: '#7DAEAB', // Col 1 (Muted slate teal)
          500: '#69A3CE', // Col 4 (Muted steel sky blue)
          600: '#5A8EB5',
          700: '#436F90',
          800: '#2E516B',
          900: '#1D3547',
          950: '#12222E',
        },
        'dark-blue': {
          50: '#F0F5F6',
          100: '#E2ECEE',
          200: '#C6DCDE',
          300: '#8BB2B9', // Col 3
          400: '#7DAEAB', // Col 1
          500: '#69A3CE', // Col 4
          600: '#5A8EB5',
          700: '#436F90',
          800: '#2E516B',
          900: '#1D3547',
          950: '#12222E',
        },
        // Neutral greys mapped directly to palette
        'light-grey': {
          50: '#F7F9F4',  // Col 4
          100: '#F6F0E4', // Col 3
          200: '#E9E5D1', // Col 4
          300: '#E5E0CC', // Col 4
          400: '#D8C8AE', // Col 3
          500: '#C2C7C1', // Col 3
        },
        'dark-grey': {
          600: '#897253', // Col 3
          700: '#544A39', // Col 1
          800: '#452A1F', // Col 4
          900: '#242C21', // Col 2
          950: '#19321C', // Col 3
        },
        // Earth-tone Gold & Mustard (from reference palette)
        gold: {
          100: '#DED6AF', // Col 1
          200: '#DFCF93', // Col 2
          300: '#C1A96F', // Col 2
          400: '#C2A856', // Col 1
          500: '#716A40', // Col 2
          600: '#7A7A3F', // Col 2
          700: '#47512F', // Col 2
        },
        // Semantic Red Exception: Strictly reserved for "Overspent", "Deficit", and "Overdue check-in" alerts
        'alert-red': {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'serif'],
      },
    },
  },
  plugins: [],
};

