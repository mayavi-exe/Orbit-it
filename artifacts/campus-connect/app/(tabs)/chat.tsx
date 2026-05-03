import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTabPadding } from "@/hooks/useTabPadding";
import {
  useGetConversations,
  useSearchUsers,
  useStartConversation,
  useGetMatches,
  getGetConversationsQueryKey,
  getSearchUsersQueryKey,
  getGetMatchesQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { UserAvatar } from "@/components/UserAvatar";

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ChatScreen() {
  const colors = useColors();
  const { topPad, bottomPad } = useTabPadding();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = searchQuery.trim().length > 0;

  const startConvMutation = useStartConversation();

  const { data, isLoading, refetch } = useGetConversations({
    query: { queryKey: getGetConversationsQueryKey(), enabled: !isSearching },
  });

  const { data: matchesData } = useGetMatches({
    query: { queryKey: getGetMatchesQueryKey(), enabled: !isSearching },
  });

  const { data: userResults, isFetching: searchingUsers } = useSearchUsers(
    { q: searchQuery.trim(), limit: 20 },
    { query: { queryKey: getSearchUsersQueryKey({ q: searchQuery.trim(), limit: 20 }), enabled: isSearching } }
  );

  const conversations = data?.conversations ?? [];
  const searchedUsers = userResults?.users ?? [];
  const allMatches = matchesData?.matches ?? [];

  const activeConvUserIds = new Set(conversations.map(c => c.otherUser?.id).filter(Boolean));
  const freshMatches = allMatches
    .filter(m => m.otherUser && !activeConvUserIds.has(m.otherUser.id))
    .slice(0, 12);

  const handleMessage = (userId: string) => {
    startConvMutation.mutate(
      { data: { userId } },
      { onSuccess: (conv) => router.push(`/chat/${conv.id}` as any) }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
          <TouchableOpacity
            style={[styles.composeBtn, { backgroundColor: colors.primary + "18" }]}
            onPress={() => setSearchQuery("")}
          >
            <Feather name="edit-2" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchBar, { backgroundColor: colors.muted }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search"
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {isSearching && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x-circle" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        searchingUsers ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : searchedUsers.length === 0 ? (
          <View style={styles.center}>
            <Feather name="search" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Try a different name or username</Text>
          </View>
        ) : (
          <FlatList
            data={searchedUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleMessage(item.id)}
                disabled={startConvMutation.isPending}
                activeOpacity={0.7}
              >
                <UserAvatar name={item.name} profilePhotos={item.profilePhotos} size={56} />
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                  {item.username && (
                    <Text style={[styles.subtext, { color: colors.mutedForeground }]}>@{item.username}</Text>
                  )}
                  {item.college?.name && (
                    <Text style={[styles.subtext, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {item.college.name}
                    </Text>
                  )}
                </View>
                <View style={[styles.msgBtn, { backgroundColor: colors.primary }]}>
                  {startConvMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="message-circle" size={16} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        <>
          {freshMatches.length > 0 && (
            <View style={[styles.matchesSection, { borderBottomColor: colors.border }]}>
              <Text style={[styles.matchesLabel, { color: colors.mutedForeground }]}>New Matches</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.matchesScroll}
              >
                {freshMatches.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.matchItem}
                    onPress={() => m.otherUser && handleMessage(m.otherUser.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.matchRing, { borderColor: colors.primary }]}>
                      <View style={styles.matchAvatarInner}>
                        <UserAvatar
                          name={m.otherUser?.name ?? "?"}
                          profilePhotos={m.otherUser?.profilePhotos}
                          size={52}
                        />
                      </View>
                    </View>
                    <Text style={[styles.matchName, { color: colors.foreground }]} numberOfLines={1}>
                      {m.otherUser?.name?.split(" ")[0] ?? ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {isLoading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1, paddingTop: 4 }}
              onRefresh={refetch}
              refreshing={isLoading}
              ListEmptyComponent={
                <View style={styles.center}>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                    <Feather name="message-circle" size={32} color={colors.mutedForeground} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Match with someone and say hello
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const unread = (item.unreadCount ?? 0) > 0;
                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push(`/chat/${item.id}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.avatarWrap,
                      unread && { borderWidth: 2.5, borderColor: colors.primary, borderRadius: 32, padding: 2 },
                    ]}>
                      <UserAvatar
                        name={item.otherUser?.name ?? "?"}
                        profilePhotos={item.otherUser?.profilePhotos}
                        size={54}
                      />
                    </View>

                    <View style={styles.info}>
                      <View style={styles.nameRow}>
                        <Text
                          style={[styles.name, { color: colors.foreground, fontWeight: unread ? "700" : "500" }]}
                          numberOfLines={1}
                        >
                          {item.otherUser?.name ?? "User"}
                        </Text>
                        <Text style={[styles.time, { color: colors.mutedForeground }]}>
                          {timeAgo(item.lastMessageAt)}
                        </Text>
                      </View>
                      <View style={styles.previewRow}>
                        <Text
                          style={[
                            styles.preview,
                            {
                              color: unread ? colors.foreground : colors.mutedForeground,
                              fontWeight: unread ? "600" : "400",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item.lastMessage ?? "Tap to start a conversation"}
                        </Text>
                        {unread && (
                          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: "800" },
  composeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 15 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  matchesSection: {
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  matchesLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  matchesScroll: { paddingHorizontal: 12, gap: 18 },
  matchItem: { alignItems: "center", width: 66 },
  matchRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  matchAvatarInner: { borderRadius: 28, overflow: "hidden" },
  matchName: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  avatarWrap: { borderRadius: 32 },
  info: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  name: { fontSize: 15, flex: 1, marginRight: 8 },
  subtext: { fontSize: 13, marginTop: 1 },
  time: { fontSize: 12 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  preview: { flex: 1, fontSize: 13 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  msgBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
