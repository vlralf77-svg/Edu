import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.familycall.app',
  appName: '가족통화',
  webDir: 'dist',
  backgroundColor: '#F6FAFA',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0EA5A4',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0EA5A4',
    },
  },
};

export default config;
