import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.etnofield.app',
  appName: 'Etnofield',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
