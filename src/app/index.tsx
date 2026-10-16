import { Redirect } from 'expo-router';

/** Entry — auth gate in _layout redirects to /(auth) or /(tabs); default to tabs. */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
