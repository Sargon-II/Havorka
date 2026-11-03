import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.havorka.app',
  appName: 'Havorka',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
