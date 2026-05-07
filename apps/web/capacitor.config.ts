import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omniverse.app',
  appName: 'Omniverse',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
