import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geonova.survey',
  appName: 'GeoNova',
  webDir: '.next',
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    cleartext: process.env.NODE_ENV !== 'production'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#1e40af'
    }
  }
};

export default config;
