import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitlog.app',
  appName: 'FitLog',
  webDir: 'dist',
  backgroundColor: '#0F1621',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0F1621',
      showSpinner: false,
    },
  },
};

export default config;
