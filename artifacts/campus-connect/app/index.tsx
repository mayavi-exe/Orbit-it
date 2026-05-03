import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { View, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const colors = useColors();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)" />;
}
