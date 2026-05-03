import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetUserById, useSubmitReport, useBlockUser, useStartConversation, getGetUserByIdQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { UserAvatar, objectPathToUrl } from "@/components/UserAvatar";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: userProfile, isLoading } = useGetUserById(id!, {
    query: { queryKey: getGetUserByIdQueryKey(id!) },
  });
  const reportMutation = useSubmitReport();
  const blockMutation = useBlockUser();
  const startConversationMutation = useStartConversation();

  const handleMessage = () => {
    if (!id) return;
    startConversationMutation.mutate(
      { data: { userId: id } },
      {
        onSuccess: (conv) => {
          router.push(`/chat/${conv.id}` as any);
        },
      }
    );
  };

  const handleReport = () => {
    Alert.alert("Report User", "Why are you reporting this user?", [
      { text: "Spam", onPress: () => reportMutation.mutate({ data: { targetUserId: id, reason: "SPAM" } }) },
      { text: "Harassment", onPress: () => reportMutation.mutate({ data: { targetUserId: id, reason: "HARASSMENT" } }) },
      { text: "Fake Profile", onPress: () => reportMutation.mutate({ data: { targetUserId: id, reason: "FAKE_PROFILE" } }) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleBlock = () => {
    Alert.alert("Block User", "Are you sure you want to block this user?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => {
          blockMutation.mutate({ data: { userId: id! } }, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getGetUserByIdQueryKey(id!) });
              router.back();
            },
          });
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="user-x" size={48} color={colors.mutedForeground} />
        <Text style={[{ color: colors.mutedForeground, marginTop: 12 }]}>User not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 40 }}>
      <View style={styles.avatarSection}>
        <UserAvatar name={userProfile.name} profilePhotos={userProfile.profilePhotos} size={96} />
        <Text style={[styles.name, { color: colors.foreground }]}>{userProfile.name}</Text>
        {userProfile.college && (
          <View style={[styles.collegeBadge, { backgroundColor: colors.secondary }]}>
            <Feather name="map-pin" size={12} color={colors.primary} />
            <Text style={[styles.collegeText, { color: colors.secondaryForeground }]}>{userProfile.college.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={handleMessage}
          disabled={startConversationMutation.isPending}
        >
          {startConversationMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="message-square" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Message</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={handleReport}>
          <Feather name="flag" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={handleBlock}>
          <Feather name="slash" size={20} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      {userProfile.bio && (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>About</Text>
          <Text style={[styles.bioText, { color: colors.foreground }]}>{userProfile.bio}</Text>
        </View>
      )}

      {userProfile.interests && userProfile.interests.length > 0 && (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Interests</Text>
          <View style={styles.tags}>
            {userProfile.interests.map((i) => (
              <View key={i} style={[styles.tag, { backgroundColor: colors.accent }]}>
                <Text style={{ color: colors.accentForeground, fontSize: 13, fontWeight: "600" }}>{i}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarSection: { alignItems: "center", paddingVertical: 32 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#fff", fontSize: 40, fontWeight: "bold" },
  name: { fontSize: 26, fontWeight: "bold", marginBottom: 8 },
  collegeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  collegeText: { fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 24 },
  primaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  iconBtn: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  section: { marginHorizontal: 16, marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1 },
  sectionLabel: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  bioText: { fontSize: 15, lineHeight: 22 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
});
