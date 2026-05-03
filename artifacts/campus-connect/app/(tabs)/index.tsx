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
  Alert,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTabPadding } from "@/hooks/useTabPadding";
import {
  useGetFeed,
  useCreatePost,
  useToggleLike,
  getGetFeedQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";

type PostType = "TEXT" | "IMAGE" | "CONFESSION" | "EVENT";

const POST_TYPES: { label: string; value: PostType }[] = [
  { label: "Post", value: "TEXT" },
  { label: "Photo", value: "IMAGE" },
  { label: "Confession", value: "CONFESSION" },
  { label: "Event", value: "EVENT" },
];

const TYPE_COLORS: Record<PostType, string> = {
  TEXT: "#7C3AED",
  IMAGE: "#2563eb",
  CONFESSION: "#db2777",
  EVENT: "#d97706",
};

interface PickedImage {
  uri: string;
  objectPath: string | null;
  uploading: boolean;
  mimeType?: string;
}

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return "/api";
}

export default function FeedScreen() {
  const colors = useColors();
  const { topPad, bottomPad } = useTabPadding();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const [filter, setFilter] = useState<PostType | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState<PostType>("TEXT");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [pickedImages, setPickedImages] = useState<PickedImage[]>([]);

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

  const uploadImage = async (image: PickedImage, index: number) => {
    try {
      const token = await getToken();
      const apiBase = getApiBase();
      const mimeType = image.mimeType ?? "image/jpeg";
      const filename = image.uri.split("/").pop() ?? "photo.jpg";

      const urlRes = await fetch(`${apiBase}/storage/uploads/request-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: filename, size: 0, contentType: mimeType }),
      });

      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const imgRes = await fetch(image.uri);
      const blob = await imgRes.blob();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });

      if (!putRes.ok) throw new Error("Upload failed");

      setPickedImages(prev =>
        prev.map((img, i) =>
          i === index ? { ...img, objectPath, uploading: false } : img
        )
      );
    } catch (err) {
      setPickedImages(prev =>
        prev.map((img, i) =>
          i === index ? { ...img, uploading: false } : img
        )
      );
      Alert.alert("Upload Failed", "Could not upload image. Please try again.");
    }
  };

  const pickImage = async () => {
    if (pickedImages.length >= 4) {
      Alert.alert("Limit reached", "You can attach up to 4 images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    const newImage: PickedImage = {
      uri: asset.uri,
      objectPath: null,
      uploading: true,
      mimeType: asset.mimeType ?? "image/jpeg",
    };

    const newIndex = pickedImages.length;
    setPickedImages(prev => [...prev, newImage]);
    uploadImage(newImage, newIndex);
  };

  const removeImage = (index: number) => {
    setPickedImages(prev => prev.filter((_, i) => i !== index));
  };

  const resetModal = () => {
    setShowCreate(false);
    setPostContent("");
    setPostType("TEXT");
    setIsAnonymous(false);
    setPickedImages([]);
  };

  const handleCreatePost = () => {
    const hasImages = pickedImages.length > 0;
    const isUploading = pickedImages.some(img => img.uploading);

    if (!postContent.trim() && !hasImages) {
      Alert.alert("Empty Post", "Please write something or add an image.");
      return;
    }
    if (isUploading) {
      Alert.alert("Uploading", "Please wait for images to finish uploading.");
      return;
    }

    const mediaUrls = pickedImages
      .filter(img => img.objectPath)
      .map(img => img.objectPath!);

    const resolvedType: PostType = hasImages && postType === "TEXT" ? "IMAGE" : postType;

    createMutation.mutate(
      {
        data: {
          content: postContent.trim() || undefined,
          mediaUrls,
          postType: resolvedType,
          isAnonymous,
        },
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          resetModal();
          queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
        },
        onError: () => {
          Alert.alert("Error", "Failed to create post. Please try again.");
        },
      }
    );
  };

  const renderImages = (mediaUrls: string[]) => {
    if (!mediaUrls || mediaUrls.length === 0) return null;
    const apiBase = getApiBase();

    const toUrl = (path: string) => {
      if (path.startsWith("http")) return path;
      const clean = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
      return `${apiBase}/storage/objects/${clean}`;
    };

    return (
      <View style={styles.imageGrid}>
        {mediaUrls.slice(0, 4).map((url, i) => (
          <Image
            key={i}
            source={{ uri: toUrl(url) }}
            style={[
              styles.postImage,
              mediaUrls.length === 1 && styles.postImageFull,
            ]}
            resizeMode="cover"
          />
        ))}
      </View>
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

      {renderImages(item.mediaUrls)}

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
              <TouchableOpacity onPress={resetModal}>
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
              placeholder={
                postType === "CONFESSION" ? "Share your confession anonymously..." :
                postType === "EVENT" ? "Describe the event..." :
                postType === "IMAGE" ? "Add a caption... (optional)" :
                "What's on your mind?"
              }
              placeholderTextColor={colors.mutedForeground}
              value={postContent}
              onChangeText={setPostContent}
              multiline
              autoFocus
              maxLength={500}
            />

            {pickedImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewRow}>
                {pickedImages.map((img, i) => (
                  <View key={i} style={styles.previewWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.previewImage} resizeMode="cover" />
                    {img.uploading ? (
                      <View style={styles.uploadOverlay}>
                        <ActivityIndicator color="#fff" size="small" />
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(i)}>
                        <Feather name="x" size={12} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.imagePickerBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
              onPress={pickImage}
            >
              <Feather name="image" size={16} color={colors.mutedForeground} />
              <Text style={[styles.imagePickerText, { color: colors.mutedForeground }]}>
                {pickedImages.length > 0 ? `${pickedImages.length}/4 images` : "Add image"}
              </Text>
            </TouchableOpacity>

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
              style={[styles.postBtn, { backgroundColor: colors.primary, opacity: createMutation.isPending || pickedImages.some(i => i.uploading) ? 0.7 : 1 }]}
              onPress={handleCreatePost}
              disabled={createMutation.isPending || pickedImages.some(i => i.uploading)}
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
  content: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  postImage: {
    width: "48%",
    height: 160,
    borderRadius: 8,
  },
  postImageFull: {
    width: "100%",
    height: 220,
  },
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
    gap: 14,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  typeRow: { flexDirection: "row", gap: 6 },
  typeBtn: { paddingVertical: 8, borderRadius: 12, alignItems: "center" },
  postInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
  },
  imagePreviewRow: { flexDirection: "row" },
  previewWrapper: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    marginRight: 8,
    position: "relative",
  },
  previewImage: { width: "100%", height: "100%" },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  imagePickerText: { fontSize: 14, fontWeight: "500" },
  anonRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  anonLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  postBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  postBtnText: { fontSize: 16, fontWeight: "700" },
});
