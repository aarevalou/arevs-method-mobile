const { expo } = require("./app.json");

module.exports = ({ config }) => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (process.env.EAS_BUILD === "true" && (!supabaseUrl || !supabaseAnonKey)) {
    throw new Error(
      "Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en el entorno EAS seleccionado para esta compilación."
    );
  }

  return {
    ...config,
    ...expo,
    icon: "./src/assets/logo.png",
    android: {
      ...config.android,
      ...expo.android,
      adaptiveIcon: {
        foregroundImage: "./src/assets/logo-android-foreground.png",
        backgroundColor: "#01070A",
      },
    },
    extra: {
      ...config.extra,
      ...expo.extra,
      supabaseUrl: supabaseUrl || "",
      supabaseAnonKey: supabaseAnonKey || "",
    },
  };
};
