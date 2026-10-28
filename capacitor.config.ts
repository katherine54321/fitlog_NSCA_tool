import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fitlog.sciencefitness",
  appName: "FitMine",
  webDir: "dist-pwa",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "never",
    scrollEnabled: true,
  },
};

export default config;
