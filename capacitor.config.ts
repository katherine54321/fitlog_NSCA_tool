import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fitlog.sciencefitness",
  appName: "FitMine 科学力量训练",
  webDir: "dist-pwa",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
  },
};

export default config;
