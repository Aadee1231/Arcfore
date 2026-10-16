import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/** Warms up the Android browser for faster SSO flows (no-op on iOS/web). */
export function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      void WebBrowser.warmUpAsync();
      return () => {
        void WebBrowser.coolDownAsync();
      };
    }
    return undefined;
  }, []);
}
