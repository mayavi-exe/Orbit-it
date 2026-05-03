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
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useChatSocket, type ChatMessage } from "@/hooks/useChatSocket";

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<FlatList>(null);
  const initializedRef = useRef(false);

  const { data, isLoading } = useGetMessages(id ?? "", undefined, {
    query: { queryKey: getGetMessagesQueryKey(id ?? ""), enabled: !!id },
  });
  const sendMutation = useSendMessage();

  useEffect(() => {
    navigation.setOptions({ title: "Chat" });
  }, []);

  useEffect(() => {
    if (data?.messages && !initializedRef.current) {
      initializedRef.current = true;
      setLocalMessages([...(data.messages as ChatMessage[])].reverse());
    }
  }, [data?.messages]);

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (msg.senderId === user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [msg, ...prev];
    });
    queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
  }, [user?.id]);

  useChatSocket(id ?? null, handleNewMessage);

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
          data={localMessages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Say hello to start the conversation
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.senderId === myId;
            return (
              <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                <View
                  style={[
                    styles.bubbleBg,
                    {
                      backgroundColor: isMe ? colors.primary : colors.card,
                      borderColor: colors.border,
                      borderWidth: isMe ? 0 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: isMe ? colors.primaryForeground : colors.foreground }]}>
                    {item.content}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View
        style={[
          styles.inputBar,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad },
        ]}
      >
        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: message.trim() ? colors.primary : colors.muted }]}
          onPress={handleSend}
          disabled={!message.trim() || sendMutation.isPending}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="send" size={20} color={message.trim() ? colors.primaryForeground : colors.mutedForeground} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, textAlign: "center" },
  bubble: { marginBottom: 6 },
  bubbleLeft: { alignItems: "flex-start" },
  bubbleRight: { alignItems: "flex-end" },
  bubbleBg: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
