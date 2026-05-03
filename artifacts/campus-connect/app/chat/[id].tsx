import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetMessages,
  useSendMessage,
  getGetMessagesQueryKey,
  getGetConversationsQueryKey,
  GetConversations200,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useChatSocket, type ChatMessage } from "@/hooks/useChatSocket";
import { UserAvatar, getApiBase } from "@/components/UserAvatar";

function formatGroupHeader(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

const TIME_GAP_MS = 30 * 60 * 1000;

async function callMarkRead(conversationId: string) {
  try {
    const base = getApiBase();
    await fetch(`${base}/api/chat/${conversationId}/read`, { method: "POST" });
  } catch {
    // non-critical
  }
}

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [readByOther, setReadByOther] = useState(false);
  const listRef = useRef<FlatList>(null);
  const initializedRef = useRef(false);

  const convData = queryClient.getQueryData<GetConversations200>(getGetConversationsQueryKey());
  const conv = convData?.conversations?.find(c => c.id === id);
  const otherUser = conv?.otherUser;

  const { data, isLoading } = useGetMessages(id ?? "", undefined, {
    query: { queryKey: getGetMessagesQueryKey(id ?? ""), enabled: !!id },
  });
  const sendMutation = useSendMessage();

  useEffect(() => {
    if (otherUser?.name) {
      navigation.setOptions({
        headerTitleAlign: "center" as const,
        headerTitle: () => (
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontWeight: "700", fontSize: 15, color: colors.foreground }}>
              {otherUser.name}
            </Text>
          </View>
        ),
        headerRight: () => (
          <View style={{ flexDirection: "row", gap: 16, marginRight: 4 }}>
            <TouchableOpacity>
              <Feather name="phone" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity>
              <Feather name="video" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        ),
      });
    } else {
      navigation.setOptions({ title: "Chat" });
    }
  }, [otherUser?.name, colors.foreground]);

  useEffect(() => {
    if (data?.messages && !initializedRef.current) {
      initializedRef.current = true;
      const msgs = [...(data.messages as ChatMessage[])].reverse();
      setLocalMessages(msgs);
      const myId = user?.id;
      if (msgs.some(m => m.senderId === myId && m.status === "READ")) {
        setReadByOther(true);
      }
    }
  }, [data?.messages, user?.id]);

  const handleNewMessage = useCallback(
    (msg: ChatMessage) => {
      if (msg.senderId === user?.id) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLocalMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [msg, ...prev];
      });
      queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
      if (id) void callMarkRead(id);
    },
    [user?.id, id]
  );

  const handleMessagesRead = useCallback(
    (_convId: string, readerId: string) => {
      if (readerId === user?.id) return;
      setReadByOther(true);
      setLocalMessages(prev =>
        prev.map(m =>
          m.senderId === user?.id && m.status !== "READ" ? { ...m, status: "READ" } : m
        )
      );
    },
    [user?.id]
  );

  useChatSocket(id ?? null, handleNewMessage, handleMessagesRead);

  const handleSend = () => {
    const text = message.trim();
    if (!text || !id) return;
    setMessage("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    sendMutation.mutate(
      { conversationId: id, data: { content: text, messageType: "TEXT" } },
      {
        onSuccess: (newMsg) => {
          setLocalMessages(prev => {
            const cast = newMsg as ChatMessage;
            if (prev.some(m => m.id === cast.id)) return prev;
            return [cast, ...prev];
          });
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
        },
      }
    );
  };

  const myId = user?.id;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom + 4;
  const hasText = message.trim().length > 0;

  type TimestampItem = { type: "timestamp"; key: string; label: string };
  type ListItem = ChatMessage | TimestampItem;

  const listData: ListItem[] = [];
  for (let i = 0; i < localMessages.length; i++) {
    const msg = localMessages[i]!;
    const prev = localMessages[i + 1];
    listData.push(msg);
    const shouldShowTs =
      !prev ||
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > TIME_GAP_MS;
    if (shouldShowTs) {
      listData.push({
        type: "timestamp",
        key: `ts-${msg.id}`,
        label: formatGroupHeader(prev?.createdAt ?? msg.createdAt),
      });
    }
  }

  const lastSentIdx = readByOther
    ? listData.findIndex(item => !("type" in item) && (item as ChatMessage).senderId === myId)
    : -1;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {isLoading && localMessages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={listData}
          keyExtractor={(item) => ("type" in item ? item.key : item.id)}
          inverted
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {otherUser && (
                <View style={styles.emptyAvatarWrap}>
                  <UserAvatar
                    name={otherUser.name}
                    profilePhotos={otherUser.profilePhotos}
                    size={72}
                  />
                </View>
              )}
              <Text style={[styles.emptyName, { color: colors.foreground }]}>
                {otherUser?.name ?? ""}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Say hello to start the conversation 👋
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            if ("type" in item) {
              return (
                <View style={styles.tsRow}>
                  <Text style={[styles.tsText, { color: colors.mutedForeground }]}>
                    {item.label}
                  </Text>
                </View>
              );
            }
            const isMe = item.senderId === myId;
            const isLastSent = index === lastSentIdx;

            return (
              <View>
                <View
                  style={[
                    styles.msgRow,
                    isMe ? styles.msgRowRight : styles.msgRowLeft,
                  ]}
                >
                  {!isMe && (
                    <View style={styles.receiverAvatar}>
                      <UserAvatar
                        name={otherUser?.name ?? "?"}
                        profilePhotos={otherUser?.profilePhotos}
                        size={28}
                      />
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      isMe
                        ? [styles.bubbleSent, { backgroundColor: colors.primary }]
                        : [styles.bubbleReceived, { backgroundColor: colors.card }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isMe ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {item.content}
                    </Text>
                  </View>
                </View>

                {isLastSent && (
                  <View style={styles.seenRow}>
                    <View style={styles.seenAvatar}>
                      <UserAvatar
                        name={otherUser?.name ?? "?"}
                        profilePhotos={otherUser?.profilePhotos}
                        size={16}
                      />
                    </View>
                    <Text style={[styles.seenText, { color: colors.mutedForeground }]}>
                      Seen
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: bottomPad,
          },
        ]}
      >
        <TouchableOpacity style={styles.inputIcon}>
          <Feather name="camera" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.inputIcon}>
          <Feather name="image" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View
          style={[
            styles.inputPill,
            { backgroundColor: colors.input, borderColor: colors.border },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
            returnKeyType="default"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: hasText ? colors.primary : "transparent" },
          ]}
          onPress={handleSend}
          disabled={sendMutation.isPending}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : hasText ? (
            <Feather name="send" size={18} color={colors.primaryForeground} />
          ) : (
            <Feather name="heart" size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: { flex: 1, alignItems: "center", paddingTop: 48, gap: 10 },
  emptyAvatarWrap: { marginBottom: 4 },
  emptyName: { fontSize: 17, fontWeight: "700" },
  emptyHint: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  tsRow: { alignItems: "center", marginVertical: 12 },
  tsText: { fontSize: 12, fontWeight: "500" },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
    gap: 6,
  },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  receiverAvatar: { width: 28, flexShrink: 0 },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  bubbleSent: { borderBottomRightRadius: 4 },
  bubbleReceived: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  seenRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    marginBottom: 6,
    paddingRight: 2,
  },
  seenAvatar: { borderRadius: 8, overflow: "hidden" },
  seenText: { fontSize: 11, fontWeight: "500" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 2,
  },
  inputPill: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 8 : 6,
    minHeight: 40,
    justifyContent: "center",
  },
  input: {
    fontSize: 15,
    maxHeight: 100,
    padding: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 2,
  },
});
