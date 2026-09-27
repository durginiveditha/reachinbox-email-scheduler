import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#4f6ef7',
          600: '#3b5bf5',
          700: '#2a47e8',
          900: '#1a2d9f',
        },
        surface: {
          0: '#ffffff',
          1: '#f8f9fc',
          2: '#f0f2f8',
          3: '#e4e7f0',
        },
        ink: {
          1: '#0f1423',
          2: '#2d3555',
          3: '#5c6480',
          4: '#9099b5',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(15,20,35,0.08), 0 1px 2px rgba(15,20,35,0.04)',
        'card-md': '0 4px 12px rgba(15,20,35,0.1), 0 2px 4px rgba(15,20,35,0.06)',
        'card-lg': '0 8px 24px rgba(15,20,35,0.12), 0 4px 8px rgba(15,20,35,0.06)',
      }
    },
  },
  plugins: [],
}
export default config
