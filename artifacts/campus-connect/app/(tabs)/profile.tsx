import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";
import {
  useGetMe,
  useGetUserStats,
  useUpdateProfile,
  getGetMeQueryKey,
  getGetUserStatsQueryKey,
} from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";

const INTERESTS = [
  "Music", "Sports", "Art", "Tech", "Gaming", "Travel",
  "Food", "Books", "Movies", "Dance", "Fitness", "Photography",
  "Fashion", "Politics", "Memes",
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const [editing, setEditing] = useState(false);

  const { data: meData, isLoading: meLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  });

  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  React.useEffect(() => {
    if (meData && !editing) {
      setBio(meData.bio ?? "");
      setInterests(meData.interests ?? []);
    }
  }, [meData, editing]);

  const { data: stats } = useGetUserStats({
    query: { queryKey: getGetUserStatsQueryKey() },
  });

  const updateMutation = useUpdateProfile();

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const saveProfile = () => {
    updateMutation.mutate(
      { data: { bio, interests } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setEditing(false);
        },
        onError: () => {
          Alert.alert("Error", "Failed to update profile.");
        },
      }
    );
  };

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          queryClient.clear();
        },
      },
    ]);
  };

  if (meLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const user = meData;
  const avatarLetter = user?.name?.[0]?.toUpperCase() ?? clerkUser?.firstName?.[0]?.toUpperCase() ?? "?";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        <View style={styles.headerActions}>
          {editing ? (
            <>
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: colors.muted }]}
                onPress={() => {
                  setEditing(false);
                  setBio(user?.bio ?? "");
                  setInterests(user?.interests ?? []);
                }}
              >
                <Ionicons name="close" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: colors.primary }]}
                onPress={saveProfile}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.muted }]}
              onPress={() => setEditing(true)}
            >
              <Ionicons name="create-outline" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: colors.primary, width: Math.min(width * 0.24, 96), height: Math.min(width * 0.24, 96), borderRadius: Math.min(width * 0.12, 48) }]}>
          <Text style={[styles.avatarText, { fontSize: Math.min(width * 0.1, 38) }]}>{avatarLetter}</Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name ?? clerkUser?.fullName ?? "User"}</Text>
        {user?.username && (
          <View style={[styles.usernameBadge, { backgroundColor: colors.primary + "18" }]}>
            <Text style={[styles.usernameText, { color: colors.primary }]}>@{user.username}</Text>
          </View>
        )}
        <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? ""}</Text>
        {user?.college && (
          <View style={[styles.collegeBadge, { backgroundColor: colors.secondary }]}>
            <Ionicons name="location-outline" size={12} color={colors.primary} />
            <Text style={[styles.collegeText, { color: colors.secondaryForeground }]}>
              {user.college.name}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.statsRow, { borderColor: colors.border }]}>
        {[
          { label: "Posts", value: stats?.postsCount ?? 0, icon: "newspaper-outline" },
          { label: "Matches", value: stats?.matchesCount ?? 0, icon: "heart-outline" },
          { label: "Likes", value: stats?.likesReceived ?? 0, icon: "thumbs-up-outline" },
        ].map((s, i) => (
          <View
            key={s.label}
            style={[
              styles.stat,
              i < 2 && { borderRightWidth: 1, borderRightColor: colors.border },
            ]}
          >
            <Ionicons name={s.icon as any} size={18} color={colors.primary} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Bio</Text>
        {editing ? (
          <TextInput
            style={[styles.bioInput, { backgroundColor: colors.input, color: colors.foreground, borderColor: colors.border }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Write something about yourself..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={300}
          />
        ) : (
          <Text style={[styles.bioText, { color: user?.bio ? colors.foreground : colors.mutedForeground }]}>
            {user?.bio ?? "No bio yet. Tap edit to add one."}
          </Text>
        )}
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Interests</Text>
        {editing ? (
          <View style={styles.tags}>
            {INTERESTS.map(interest => (
              <TouchableOpacity
                key={interest}
                style={[
                  styles.tag,
                  { backgroundColor: interests.includes(interest) ? colors.primary : colors.muted },
                ]}
                onPress={() => toggleInterest(interest)}
              >
                <Text style={{ color: interests.includes(interest) ? colors.primaryForeground : colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>
                  {interest}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : user?.interests && user.interests.length > 0 ? (
          <View style={styles.tags}>
            {user.interests.map(i => (
              <View key={i} style={[styles.tag, { backgroundColor: colors.accent }]}>
                <Text style={{ color: colors.accentForeground, fontSize: 13, fontWeight: "600" }}>{i}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyInterests}>
            <Ionicons name="heart-outline" size={28} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: "center" }}>
              No interests yet.{"\n"}Tap edit to add some.
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "bold" },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  avatarText: { color: "#fff", fontWeight: "bold" },
  name: { fontSize: 24, fontWeight: "bold" },
  usernameBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  usernameText: { fontSize: 16, fontWeight: "700" },
  email: { fontSize: 14 },
  collegeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  collegeText: { fontSize: 13, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
  },
  statValue: { fontSize: 22, fontWeight: "bold" },
  statLabel: { fontSize: 12, marginTop: 2 },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  sectionLabel: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  bioInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  bioText: { fontSize: 15, lineHeight: 22 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  emptyInterests: { alignItems: "center", gap: 8, paddingVertical: 12 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  logoutText: { fontSize: 16, fontWeight: "600" },
});
