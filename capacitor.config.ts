import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 안드로이드 네이티브 프로젝트의 applicationId 와 일치시켜야 한다.
  // (변경하려면 android/app/build.gradle 의 applicationId 도 함께 변경.)
  appId: 'com.tinylearn.app',
  appName: '헬스맨',
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
