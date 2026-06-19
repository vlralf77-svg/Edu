import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tinylearn.app',
  appName: '티니런',
  webDir: 'dist',
  backgroundColor: '#FFF8E7',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#7F77DD',
      showSpinner: false,
    },
  },
};

export default config;
