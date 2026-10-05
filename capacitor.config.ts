import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.reubendeklerk.matchreview",
  appName: "WhosMyOpponent",
  webDir: "dist",
  backgroundColor: "#ffffff",
  ios: {
    // Pages handle the notch and home indicator themselves with env(safe-area-inset-*).
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      // NativeShell hides it once the session check is done.
      launchAutoHide: false,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    SocialLogin: {
      providers: { apple: true, google: false, facebook: false, twitter: false },
      logLevel: 1,
    },
  },
};

export default config;
