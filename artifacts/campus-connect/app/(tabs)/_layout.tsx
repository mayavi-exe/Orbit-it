import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Slot, Tabs, usePathname, useRouter } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function useClerkToken() {
  const { isSignedIn, getToken } = useAuth();
  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    }
  }, [isSignedIn, getToken]);
}

const NAV_ITEMS = [
  {
    href: "/(tabs)" as const,
    segment: "index",
    label: "Feed",
    icon: "home-outline" as const,
    activeIcon: "home" as const,
  },
  {
    href: "/(tabs)/discover" as const,
    segment: "discover",
    label: "Discover",
    icon: "compass-outline" as const,
    activeIcon: "compass" as const,
  },
  {
    href: "/(tabs)/chat" as const,
    segment: "chat",
    label: "Messages",
    icon: "chatbubbles-outline" as const,
    activeIcon: "chatbubbles" as const,
  },
  {
    href: "/(tabs)/profile" as const,
    segment: "profile",
    label: "Profile",
    icon: "person-circle-outline" as const,
    activeIcon: "person-circle" as const,
  },
];

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <Icon sf={{ default: "sparkles", selected: "sparkles" }} />
        <Label>Discover</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <Icon sf={{ default: "message", selected: "message.fill" }} />
        <Label>Chat</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  useClerkToken();

  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "house.fill" : "house"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="sparkles" tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Messages",
          headerShown: false,
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "message.fill" : "message"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "person.crop.circle.fill" : "person.crop.circle"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

function WebLayout() {
  useClerkToken();

  const { width } = useWindowDimensions();
  const colors = useColors();
  const pathname = usePathname();
  const router = useRouter();

  const currentSegment =
    pathname === "/" || pathname === ""
      ? "index"
      : pathname.replace(/^\//, "").split("/")[0];

  const isSidebar = width >= 768;

  if (isSidebar) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
        {/* Sidebar */}
        <View
          style={{
            width: 220,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            backgroundColor: colors.background,
            paddingTop: 32,
            paddingBottom: 24,
            paddingHorizontal: 12,
          }}
        >
          <View style={{ paddingHorizontal: 8, marginBottom: 36 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
              }}
            >
              <Ionicons name="school-outline" size={20} color="#fff" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
              Campus Connect
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
              Mumbai colleges
            </Text>
          </View>

          {NAV_ITEMS.map((item) => {
            const active = currentSegment === item.segment;
            return (
              <TouchableOpacity
                key={item.label}
                onPress={() => router.push(item.href)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  borderRadius: 12,
                  marginBottom: 2,
                  backgroundColor: active ? colors.primary + "18" : "transparent",
                }}
              >
                <Ionicons
                  name={active ? item.activeIcon : item.icon}
                  size={22}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: active ? "700" : "500",
                    color: active ? colors.primary : colors.foreground,
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        <View style={{ flex: 1, overflow: "hidden" }}>
          <Slot />
        </View>
      </View>
    );
  }

  // Narrow web: bottom tab bar
  return (
    <View style={{ flex: 1, flexDirection: "column", backgroundColor: colors.background }}>
      <View style={{ flex: 1, overflow: "hidden" }}>
        <Slot />
      </View>
      <View
        style={{
          height: 64,
          flexDirection: "row",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = currentSegment === item.segment;
          return (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.href)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={24}
                color={active ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: active ? "700" : "500",
                  color: active ? colors.primary : colors.mutedForeground,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  if (Platform.OS === "web") {
    return <WebLayout />;
  }
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({});
