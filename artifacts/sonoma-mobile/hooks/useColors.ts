import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

type Palette = typeof colors.light;

export function useColors(): Palette & { radius: number } {
  const scheme = useColorScheme();
  const hasDark = "dark" in colors && typeof (colors as { dark?: Palette }).dark === "object";
  const palette: Palette = hasDark && scheme === "dark"
    ? ((colors as { dark: Palette }).dark)
    : colors.light;
  return { ...palette, radius: colors.radius };
}
