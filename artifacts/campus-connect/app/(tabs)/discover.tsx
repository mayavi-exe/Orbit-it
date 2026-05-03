import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Animated,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetRecommendations,
  useSwipe,
  useGetMatchStats,
  useSearchUsers,
  useSearchPosts,
  getGetRecommendationsQueryKey,
  getGetMatchStatsQueryKey,
  getSearchUsersQueryKey,
  getSearchPostsQueryKey,
  useStartConversation,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<"swipe" | "list">("swipe");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTab, setSearchTab] = useState<"people" | "posts">("people");
  const swipeMutation = useSwipe();
  const startConvMutation = useStartConversation();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const isSearching = searchQuery.trim().length > 0;

  const { data: recsData, isLoading } = useGetRecommendations(
    { limit: 10 },
    { query: { queryKey: getGetRecommendationsQueryKey({ limit: 10 }), enabled: !isSearching } }
  );
  const { data: statsData } = useGetMatchStats({
    query: { queryKey: getGetMatchStatsQueryKey(), enabled: !isSearching },
  });

  const { data: userResults, isFetching: searchingUsers } = useSearchUsers(
    { q: searchQuery.trim(), limit: 20 },
    { query: { queryKey: getSearchUsersQueryKey({ q: searchQuery.trim(), limit: 20 }), enabled: isSearching && searchTab === "people" } }
  );
  const { data: postResults, isFetching: searchingPosts } = useSearchPosts(
    { q: searchQuery.trim(), limit: 20 },
    { query: { queryKey: getSearchPostsQueryKey({ q: searchQuery.trim(), limit: 20 }), enabled: isSearching && searchTab === "posts" } }
  );

  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ["-15deg", "0deg", "15deg"],
  });
  const likeOpacity = position.x.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: "clamp" });
  const passOpacity = position.x.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: "clamp" });

  const recs = recsData?.recommendations ?? [];
  const current = recs[currentIndex];

  const doSwipe = (action: "LIKE" | "PASS") => {
    const rec = recs[currentIndex];
    if (!rec) return;
    const toX = action === "LIKE" ? 500 : -500;
    Animated.timing(position, { toValue: { x: toX, y: 0 }, duration: 280, useNativeDriver: true }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex(i => i + 1);
      swipeMutation.mutate(
        { data: { toUserId: rec.user.id, action } },
        {
          onSuccess: (data) => {
            if (data.matched) {
              setMatchedName(rec.user.name);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (action === "LIKE") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            queryClient.invalidateQueries({ queryKey: getGetRecommendationsQueryKey({ limit: 10 }) });
          },
        }
      );
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 100) {
          doSwipe("LIKE");
        } else if (g.dx < -100) {
          doSwipe("PASS");
        } else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleMessage = (userId: string) => {
    startConvMutation.mutate(
      { data: { userId } },
      { onSuccess: (conv) => router.push(`/chat/${conv.id}` as any) }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {matchedName && !isSearching && (
        <View style={[styles.matchBanner, { backgroundColor: colors.primary }]}>
          <Feather name="heart" size={16} color="#fff" />
          <Text style={styles.matchBannerText}>You matched with {matchedName}!</Text>
          <TouchableOpacity onPress={() => setMatchedName(null)}>
            <Feather name="x" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Discover</Text>
          {!isSearching && (
            <View style={styles.statsRow}>
              <View style={[styles.statChip, { backgroundColor: colors.secondary }]}>
                <Feather name="heart" size={12} color={colors.primary} />
                <Text style={[styles.statText, { color: colors.secondaryForeground }]}>
                  {statsData?.totalMatches ?? 0} matches
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search people, posts..."
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

        {isSearching ? (
          <View style={styles.searchTabRow}>
            {(["people", "posts"] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.searchTab, { borderBottomColor: searchTab === tab ? colors.primary : "transparent" }]}
                onPress={() => setSearchTab(tab)}
              >
                <Text style={[styles.searchTabText, { color: searchTab === tab ? colors.primary : colors.mutedForeground }]}>
                  {tab === "people" ? "People" : "Posts"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.modeToggle}>
            {(["swipe", "list"] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, { backgroundColor: mode === m ? colors.primary : colors.muted }]}
                onPress={() => setMode(m)}
              >
                <Text style={{ color: mode === m ? colors.primaryForeground : colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>
                  {m === "swipe" ? "Cards" : "List"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {isSearching ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad }}>
          {searchTab === "people" ? (
            searchingUsers ? (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : (userResults?.users ?? []).length === 0 ? (
              <View style={styles.center}>
                <Feather name="users" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No people found</Text>
              </View>
            ) : (
              (userResults?.users ?? []).map(u => (
                <View key={u.id} style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.listAvatar, { backgroundColor: colors.primary + "30" }]}>
                    <Text style={[styles.listAvatarText, { color: colors.primary }]}>
                      {u.name[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.listInfo}>
                    <Text style={[styles.listName, { color: colors.foreground }]}>{u.name}</Text>
                    {u.username && (
                      <Text style={[styles.listUsername, { color: colors.primary }]}>@{u.username}</Text>
                    )}
                    <Text style={[styles.listCollege, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {u.college?.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.msgBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleMessage(u.id)}
                  >
                    <Feather name="message-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))
            )
          ) : (
            searchingPosts ? (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : (postResults?.posts ?? []).length === 0 ? (
              <View style={styles.center}>
                <Feather name="file-text" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No posts found</Text>
              </View>
            ) : (
              (postResults?.posts ?? []).map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/post/${p.id}` as any)}
                >
                  {p.author && (
                    <View style={styles.postAuthorRow}>
                      <View style={[styles.postAvatar, { backgroundColor: colors.primary + "30" }]}>
                        <Text style={[styles.postAvatarText, { color: colors.primary }]}>
                          {p.author.name[0]?.toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.postAuthorName, { color: colors.foreground }]}>{p.author.name}</Text>
                        {p.author.username && (
                          <Text style={[styles.postAuthorUsername, { color: colors.primary }]}>@{p.author.username}</Text>
                        )}
                      </View>
                    </View>
                  )}
                  {p.isAnonymous && !p.author && (
                    <Text style={[styles.anonLabel, { color: colors.mutedForeground }]}>Anonymous</Text>
                  )}
                  <Text style={[styles.postContent, { color: colors.foreground }]} numberOfLines={4}>
                    {p.content}
                  </Text>
                  <View style={styles.postMeta}>
                    <Feather name="heart" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.postMetaText, { color: colors.mutedForeground }]}>{p.likesCount}</Text>
                    <Feather name="message-square" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.postMetaText, { color: colors.mutedForeground }]}>{p.commentsCount}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )
          )}
        </ScrollView>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : recs.length === 0 || currentIndex >= recs.length ? (
        <View style={styles.center}>
          <Feather name="users" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No more profiles</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Check back later</Text>
        </View>
      ) : mode === "swipe" ? (
        <View style={styles.cardArea}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Animated.View style={[styles.likeTag, { opacity: likeOpacity }]}>
              <Text style={styles.likeTagText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.passTag, { opacity: passOpacity }]}>
              <Text style={styles.passTagText}>PASS</Text>
            </Animated.View>

            <View style={[styles.photoPlaceholder, { backgroundColor: colors.muted }]}>
              <Text style={[styles.photoInitial, { color: colors.mutedForeground }]}>
                {current.user.name[0]?.toUpperCase()}
              </Text>
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <View>
                  <Text style={[styles.cardName, { color: colors.foreground }]}>{current.user.name}</Text>
                  {current.user.username && (
                    <Text style={[styles.cardUsername, { color: colors.primary }]}>@{current.user.username}</Text>
                  )}
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.scoreText}>{Math.round((current.compatibilityScore ?? 0) * 100)}%</Text>
                </View>
              </View>
              {current.user.college && (
                <Text style={[styles.college, { color: colors.mutedForeground }]}>
                  {current.user.college.name}
                </Text>
              )}
              {current.user.bio && (
                <Text style={[styles.bio, { color: colors.foreground }]} numberOfLines={3}>
                  {current.user.bio}
                </Text>
              )}
              {current.commonInterests.length > 0 && (
                <View style={styles.tags}>
                  {current.commonInterests.slice(0, 4).map(i => (
                    <View key={i} style={[styles.tag, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.tagText, { color: colors.accentForeground }]}>{i}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>

          <View style={styles.swipeActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.muted }]}
              onPress={() => doSwipe("PASS")}
            >
              <Feather name="x" size={28} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => doSwipe("LIKE")}
            >
              <Feather name="heart" size={28} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}>
          {recs.slice(currentIndex).map(rec => (
            <View key={rec.user.id} style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.listAvatar, { backgroundColor: colors.primary + "30" }]}>
                <Text style={[styles.listAvatarText, { color: colors.primary }]}>
                  {rec.user.name[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.listInfo}>
                <Text style={[styles.listName, { color: colors.foreground }]}>{rec.user.name}</Text>
                {rec.user.username && (
                  <Text style={[styles.listUsername, { color: colors.primary }]}>@{rec.user.username}</Text>
                )}
                <Text style={[styles.listCollege, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {rec.user.college?.name}
                </Text>
                <View style={styles.tags}>
                  {rec.commonInterests.slice(0, 2).map(i => (
                    <View key={i} style={[styles.tag, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.tagText, { color: colors.accentForeground }]}>{i}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View>
                <View style={[styles.scoreBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.scoreText}>{Math.round((rec.compatibilityScore ?? 0) * 100)}%</Text>
                </View>
                <View style={styles.listActions}>
                  <TouchableOpacity onPress={() => { setCurrentIndex(recs.indexOf(rec)); doSwipe("PASS"); }}>
                    <Feather name="x" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setCurrentIndex(recs.indexOf(rec)); doSwipe("LIKE"); }}>
                    <Feather name="heart" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold" },
  statsRow: { flexDirection: "row", gap: 8 },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statText: { fontSize: 12, fontWeight: "600" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },
  searchTabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "transparent" },
  searchTab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2 },
  searchTabText: { fontSize: 15, fontWeight: "600" },
  modeToggle: { flexDirection: "row", gap: 8 },
  modeBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 40 },
  emptyTitle: { fontSize: 20, fontWeight: "bold" },
  emptyText: { fontSize: 15 },
  cardArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  likeTag: {
    position: "absolute", top: 24, left: 24, zIndex: 10,
    backgroundColor: "#22c55e", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    transform: [{ rotate: "-15deg" }],
  },
  likeTagText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  passTag: {
    position: "absolute", top: 24, right: 24, zIndex: 10,
    backgroundColor: "#ef4444", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    transform: [{ rotate: "15deg" }],
  },
  passTagText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  photoPlaceholder: { height: 240, alignItems: "center", justifyContent: "center" },
  photoInitial: { fontSize: 72, fontWeight: "800" },
  cardInfo: { padding: 20 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  cardName: { fontSize: 22, fontWeight: "bold" },
  cardUsername: { fontSize: 14, fontWeight: "500", marginTop: 2 },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  scoreText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  college: { fontSize: 14, marginBottom: 10 },
  bio: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: "600" },
  swipeActions: { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 20 },
  actionBtn: {
    width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center",
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  listCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12, gap: 12 },
  listAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  listAvatarText: { fontWeight: "800", fontSize: 20 },
  listInfo: { flex: 1 },
  listName: { fontSize: 16, fontWeight: "600", marginBottom: 1 },
  listUsername: { fontSize: 13, fontWeight: "500", marginBottom: 2 },
  listCollege: { fontSize: 13, marginBottom: 6 },
  listActions: { flexDirection: "row", gap: 12, marginTop: 8, justifyContent: "center" },
  msgBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  matchBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  matchBannerText: { flex: 1, color: "#fff", fontWeight: "600" },
  postCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  postAuthorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  postAvatarText: { fontWeight: "700", fontSize: 14 },
  postAuthorName: { fontSize: 14, fontWeight: "600" },
  postAuthorUsername: { fontSize: 12, fontWeight: "500" },
  anonLabel: { fontSize: 13, marginBottom: 8, fontStyle: "italic" },
  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  postMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  postMetaText: { fontSize: 13, marginRight: 8 },
});
