import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.careyard.app',
  appName: 'WorkMine',
  webDir: 'public',
  server: {
    url: 'https://workmine.simplifybi.com',
    cleartext: false
  }
};

export default config;
