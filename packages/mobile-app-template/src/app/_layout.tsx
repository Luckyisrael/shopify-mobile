import { Stack } from 'expo-router';
import { ThemeProvider } from '@shopify/restyle';
import theme from '../utils/theme';

export default function Layout() {
  return <ThemeProvider theme={theme}><Stack /></ThemeProvider>;
}
