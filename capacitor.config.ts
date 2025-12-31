import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.careyard.app',
  appName: 'corefarm',
  webDir: 'public',
  server: {
    url: 'https://core-farm.vercel.app',
    cleartext: false
  }
};

export default config;
