import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetConversations,
  useSearchUsers,
  useStartConversation,
  getGetConversationsQueryKey,
  getSearchUsersQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = searchQuery.trim().length > 0;

  const startConvMutation = useStartConversation();

  const { data, isLoading, refetch } = useGetConversations({
    query: { queryKey: getGetConversationsQueryKey(), enabled: !isSearching },
  });

  const { data: userResults, isFetching: searchingUsers } = useSearchUsers(
    { q: searchQuery.trim(), limit: 20 },
    { query: { queryKey: getSearchUsersQueryKey({ q: searchQuery.trim(), limit: 20 }), enabled: isSearching } }
  );

  const conversations = data?.conversations ?? [];
  const searchedUsers = userResults?.users ?? [];

  const handleMessage = (userId: string) => {
    startConvMutation.mutate(
      { data: { userId } },
      { onSuccess: (conv) => router.push(`/chat/${conv.id}` as any) }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search people to message..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {isSearching && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        searchingUsers ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : searchedUsers.length === 0 ? (
          <View style={styles.center}>
            <Feather name="users" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No users found</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Try a different name or username
            </Text>
          </View>
        ) : (
          <FlatList
            data={searchedUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: bottomPad }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => handleMessage(item.id)}
                disabled={startConvMutation.isPending}
              >
                <View style={[styles.avatar, { backgroundColor: colors.primary + "30" }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {item.name?.[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                  {item.username && (
                    <Text style={[styles.username, { color: colors.primary }]}>@{item.username}</Text>
                  )}
                  {item.college && (
                    <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {item.college.name}
                    </Text>
                  )}
                </View>
                <View style={[styles.msgBtn, { backgroundColor: colors.primary }]}>
                  {startConvMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="message-circle" size={18} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        )
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="message-square" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Search for someone above to start chatting
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => router.push(`/chat/${item.id}` as any)}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primary + "30" }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {item.otherUser?.name?.[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.foreground }]}>
                      {item.otherUser?.name ?? "User"}
                    </Text>
                    {item.otherUser?.username && (
                      <Text style={[styles.username, { color: colors.primary }]}>
                        @{item.otherUser.username}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>
                    {timeAgo(item.lastMessageAt)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.lastMessage ?? "Start a conversation"}
                  </Text>
                  {(item.unreadCount ?? 0) > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.badgeText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 12 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyTitle: { fontSize: 20, fontWeight: "bold" },
  emptyText: { fontSize: 15, textAlign: "center", paddingHorizontal: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "700", fontSize: 20 },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 },
  name: { fontSize: 16, fontWeight: "600" },
  username: { fontSize: 13, fontWeight: "500", marginBottom: 2 },
  time: { fontSize: 12, marginTop: 2 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  preview: { flex: 1, fontSize: 14 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  msgBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
