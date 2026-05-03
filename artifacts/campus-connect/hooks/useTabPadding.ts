import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useTabPadding() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (Platform.OS !== "web") {
    return {
      topPad: insets.top,
      bottomPad: insets.bottom + 80,
    };
  }

  const isSidebar = width >= 768;
  return {
    topPad: 16,
    bottomPad: isSidebar ? 16 : 80,
  };
}
