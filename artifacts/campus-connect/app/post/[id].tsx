import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetPost,
  useGetComments,
  useAddComment,
  useToggleLike,
  getGetPostQueryKey,
  getGetCommentsQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/UserAvatar";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const { data: post, isLoading: postLoading } = useGetPost(id!, {
    query: { queryKey: getGetPostQueryKey(id!) },
  });
  const { data: commentsData, isLoading: commentsLoading } = useGetComments(id!, {}, {
    query: { queryKey: getGetCommentsQueryKey(id!, {}) },
  });
  const likeMutation = useToggleLike();
  const commentMutation = useAddComment();

  const handleLike = () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    likeMutation.mutate({ postId: id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(id) }),
    });
  };

  const handleComment = () => {
    const text = comment.trim();
    if (!text || !id) return;
    setComment("");
    commentMutation.mutate(
      { postId: id, data: { content: text } },
      {
        onSuccess: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          queryClient.invalidateQueries({ queryKey: getGetCommentsQueryKey(id, {}) });
        },
      }
    );
  };

  if (postLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const comments = commentsData?.comments ?? [];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          post ? (
            <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.postHeader}>
                {post.isAnonymous ? (
                  <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                    <Feather name="user" size={18} color={colors.mutedForeground} />
                  </View>
                ) : (
                  <UserAvatar
                    name={post.author?.name ?? "?"}
                    profilePhotos={post.author?.profilePhotos}
                    size={36}
                  />
                )}
                <View>
                  <Text style={[styles.authorName, { color: colors.foreground }]}>
                    {post.isAnonymous ? "Anonymous" : (post.author?.name ?? "Unknown")}
                  </Text>
                  <View style={[styles.typeBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.typeText, { color: colors.secondaryForeground }]}>{post.postType}</Text>
                  </View>
                </View>
              </View>
              {post.content && (
                <Text style={[styles.postContent, { color: colors.foreground }]}>{post.content}</Text>
              )}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                  <Feather name="heart" size={20} color={post.isLiked ? "#ef4444" : colors.mutedForeground} />
                  <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{post.likesCount}</Text>
                </TouchableOpacity>
                <View style={styles.actionBtn}>
                  <Feather name="message-circle" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{post.commentsCount}</Text>
                </View>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.commentRow, { borderBottomColor: colors.border }]}>
            {item.author?.name ? (
              <UserAvatar name={item.author.name} profilePhotos={item.author.profilePhotos} size={30} />
            ) : (
              <View style={[styles.commentAvatar, { backgroundColor: colors.muted }]}>
                <Feather name="user" size={14} color={colors.mutedForeground} />
              </View>
            )}
            <View style={styles.commentContent}>
              <Text style={[styles.commentName, { color: colors.foreground }]}>{item.author?.name ?? "User"}</Text>
              <Text style={[styles.commentText, { color: colors.foreground }]}>{item.content}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          commentsLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
          ) : (
            <Text style={[styles.emptyComments, { color: colors.mutedForeground }]}>No comments yet. Be the first!</Text>
          )
        }
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === "web" ? 84 : insets.bottom + 80 }}
      />
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === "web" ? 16 : insets.bottom + 4 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment..."
          placeholderTextColor={colors.mutedForeground}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: comment.trim() ? colors.primary : colors.muted }]}
          onPress={handleComment}
          disabled={!comment.trim()}
        >
          <Feather name="send" size={18} color={comment.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  postCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  authorName: { fontSize: 15, fontWeight: "600" },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 2 },
  typeText: { fontSize: 11, fontWeight: "600" },
  postContent: { fontSize: 16, lineHeight: 24, marginBottom: 16 },
  actions: { flexDirection: "row", gap: 20 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontSize: 14 },
  commentRow: { flexDirection: "row", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  commentContent: { flex: 1 },
  commentName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  commentText: { fontSize: 14, lineHeight: 20 },
  emptyComments: { textAlign: "center", paddingTop: 24, fontSize: 15 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
