import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Brokerage admin preset on Aura, using the Laurus Green scale from
 * laurus-web-app's laurus-preset.ts so both apps share one brand.
 */
export const BrokeragePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#E6FAF2',
      100: '#C2ECC8',
      200: '#8FD3AC',
      300: '#53B08A',
      400: '#26624C',
      500: '#0B3C2B',
      600: '#083224',
      700: '#06261B',
      800: '#041B13',
      900: '#020E0A',
      950: '#010705',
    },
    colorScheme: {
      light: {
        primary: { color: '#0B3C2B', contrastColor: '#FFFFFF', hoverColor: '#083224', activeColor: '#06261B' },
        highlight: { background: '#F3EEDF', focusBackground: '#EFE7D3', color: '#6E5422', focusColor: '#6E5422' },
      },
    },
  },
});
