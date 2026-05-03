import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  Platform,
  Alert,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetFeed,
  useCreatePost,
  useToggleLike,
  getGetFeedQueryKey,
  getGetPostQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

type PostType = "TEXT" | "CONFESSION" | "EVENT";

const POST_TYPES: { label: string; value: PostType }[] = [
  { label: "Post", value: "TEXT" },
  { label: "Confession", value: "CONFESSION" },
  { label: "Event", value: "EVENT" },
];

const TYPE_COLORS: Record<PostType, string> = {
  TEXT: "#7C3AED",
  CONFESSION: "#db2777",
  EVENT: "#d97706",
};

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 16 : insets.top;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom + 80;

  const [filter, setFilter] = useState<PostType | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState<PostType>("TEXT");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { data, isLoading, refetch, isFetching } = useGetFeed(
    filter ? { postType: filter } : undefined
  );
  const createMutation = useCreatePost();
  const likeMutation = useToggleLike();

  const handleLike = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    likeMutation.mutate({ postId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey(filter ? { postType: filter } : undefined) });
      },
    });
  };

  const handleCreatePost = () => {
    if (!postContent.trim()) {
      Alert.alert("Empty Post", "Please write something before posting.");
      return;
    }
    createMutation.mutate(
      { data: { content: postContent.trim(), postType, isAnonymous } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowCreate(false);
          setPostContent("");
          setPostType("TEXT");
          setIsAnonymous(false);
          queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
        },
        onError: () => {
          Alert.alert("Error", "Failed to create post. Please try again.");
        },
      }
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/post/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
            {!item.isAnonymous && item.author?.name ? (
              <Text style={[styles.avatarText, { color: colors.mutedForeground }]}>
                {item.author.name[0].toUpperCase()}
              </Text>
            ) : (
              <Feather name="user" size={14} color={colors.mutedForeground} />
            )}
          </View>
          <View>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {item.isAnonymous ? "Anonymous" : (item.author?.name ?? "User")}
            </Text>
            {item.author?.college && !item.isAnonymous && (
              <Text style={[styles.college, { color: colors.mutedForeground }]}>
                {item.author.college.name}
              </Text>
            )}
          </View>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[item.postType as PostType] + "20" }]}>
          <Text style={[styles.typeText, { color: TYPE_COLORS[item.postType as PostType] }]}>
            {item.postType}
          </Text>
        </View>
      </View>

      {item.content && (
        <Text style={[styles.content, { color: colors.foreground }]} numberOfLines={5}>
          {item.content}
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather
            name="heart"
            size={18}
            color={item.isLiked ? "#ef4444" : colors.mutedForeground}
          />
          <Text style={[styles.actionText, { color: item.isLiked ? "#ef4444" : colors.mutedForeground }]}>
            {item.likesCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/post/${item.id}` as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="message-circle" size={18} color={colors.mutedForeground} />
          <Text style={[styles.actionText, { color: colors.mutedForeground }]}>{item.commentsCount}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Campus Connect</Text>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: !filter ? colors.primary : colors.muted }]}
          onPress={() => setFilter(undefined)}
        >
          <Text style={{ color: !filter ? colors.primaryForeground : colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>
            All
          </Text>
        </TouchableOpacity>
        {POST_TYPES.map(pt => (
          <TouchableOpacity
            key={pt.value}
            style={[styles.filterChip, { backgroundColor: filter === pt.value ? colors.primary : colors.muted }]}
            onPress={() => setFilter(prev => prev === pt.value ? undefined : pt.value)}
          >
            <Text style={{ color: filter === pt.value ? colors.primaryForeground : colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>
              {pt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data?.posts ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No posts yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Be the first to post something!
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomPad - 60 }]}
        onPress={() => setShowCreate(true)}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </TouchableOpacity>

      <Modal visible={showCreate} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Post</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.typeRow}>
              {POST_TYPES.map(pt => (
                <TouchableOpacity
                  key={pt.value}
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor: postType === pt.value ? colors.primary : colors.muted,
                      flex: 1,
                    },
                  ]}
                  onPress={() => setPostType(pt.value)}
                >
                  <Text style={{ color: postType === pt.value ? colors.primaryForeground : colors.mutedForeground, fontWeight: "600", fontSize: 13 }}>
                    {pt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.postInput, { backgroundColor: colors.input, color: colors.foreground, borderColor: colors.border }]}
              placeholder={postType === "CONFESSION" ? "Share your confession anonymously..." : postType === "EVENT" ? "Describe the event...": "What's on your mind?"}
              placeholderTextColor={colors.mutedForeground}
              value={postContent}
              onChangeText={setPostContent}
              multiline
              autoFocus
              maxLength={500}
            />

            <View style={styles.anonRow}>
              <Feather name="eye-off" size={16} color={colors.mutedForeground} />
              <Text style={[styles.anonLabel, { color: colors.foreground }]}>Post anonymously</Text>
              <Switch
                value={isAnonymous || postType === "CONFESSION"}
                onValueChange={setIsAnonymous}
                disabled={postType === "CONFESSION"}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity
              style={[styles.postBtn, { backgroundColor: colors.primary, opacity: createMutation.isPending ? 0.7 : 1 }]}
              onPress={handleCreatePost}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.postBtnText, { color: colors.primaryForeground }]}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "800" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  userInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "700", fontSize: 13 },
  name: { fontWeight: "600", fontSize: 14 },
  college: { fontSize: 11, marginTop: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typeText: { fontSize: 11, fontWeight: "700" },
  content: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  actions: { flexDirection: "row", gap: 20 },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { fontSize: 13, fontWeight: "500" },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { paddingVertical: 8, borderRadius: 12, alignItems: "center" },
  postInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: "top",
  },
  anonRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  anonLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  postBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  postBtnText: { fontSize: 16, fontWeight: "700" },
});
