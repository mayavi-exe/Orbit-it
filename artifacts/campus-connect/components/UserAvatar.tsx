import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return "/api";
}

export function objectPathToUrl(objectPath: string): string {
  const apiBase = getApiBase();
  if (objectPath.startsWith("http")) return objectPath;
  const clean = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath;
  return `${apiBase}/storage/objects/${clean}`;
}

interface UserAvatarProps {
  name: string;
  profilePhotos?: string[] | null;
  size?: number;
}

export function UserAvatar({ name, profilePhotos, size = 40 }: UserAvatarProps) {
  const colors = useColors();
  const radius = size / 2;
  const fontSize = Math.round(size * 0.38);
  const photo = profilePhotos?.[0];

  if (photo) {
    return (
      <Image
        source={{ uri: objectPathToUrl(photo) }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: colors.primary + "28" },
      ]}
    >
      <Text style={[styles.initial, { color: colors.primary, fontSize }]}>
        {name?.[0]?.toUpperCase() ?? "?"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { fontWeight: "800" },
});
