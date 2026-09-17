import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fitlog.sciencefitness",
  appName: "FitLog 科学健身助手",
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
