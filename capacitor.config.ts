import type { CapacitorConfig } from '@capacitor/cli';

/**
 * EstateFlow mobile app. Release builds only talk to an HTTPS API.
 *
 * Debug override: to point a development build at an http:// API on your LAN, run
 *   CAP_ALLOW_HTTP=1 npm run android:sync
 * which allows cleartext traffic and mixed content for that build only. Never ship a build made this way.
 */
const allowHttp = process.env.CAP_ALLOW_HTTP === '1';

const config: CapacitorConfig = {
  appId: 'com.thegradlew.estateflow',
  appName: 'EstateFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    ...(allowHttp ? { cleartext: true } : {}),
  },
  android: {
    backgroundColor: '#062419',
    ...(allowHttp ? { allowMixedContent: true } : {}),
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,
      launchFadeOutDuration: 250,
      backgroundColor: '#062419',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#062419',
      overlaysWebView: false,
    },
    LocalNotifications: {
      iconColor: '#0f5132',
    },
  },
};

export default config;
