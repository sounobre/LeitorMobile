import {
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
} from 'react-native-paper';

const brand = {
  primary: '#516A4B',
  secondary: '#6D5F43',
  tertiary: '#506777',
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    ...brand,
    background: '#F8F7F1',
    surface: '#FFFDF7',
    surfaceVariant: '#E5E5D9',
    primaryContainer: '#D3E8CB',
    onPrimaryContainer: '#10220E',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#B7CCAF',
    secondary: '#D7C4A0',
    tertiary: '#B5CBD9',
    background: '#171914',
    surface: '#1D211B',
    surfaceVariant: '#42483E',
  },
};

export const readerPalette = {
  light: { background: '#FFFDF7', text: '#24251F' },
  sepia: { background: '#F4ECD8', text: '#3C3328' },
  dark: { background: '#171914', text: '#E4E4DB' },
} as const;
