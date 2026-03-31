import React, { useState, useRef, useCallback } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { getApiUrl } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let messageCounter = 0;
function generateId(): string {
  messageCounter++;
  return `msg-${Date.now()}-${messageCounter}-${Math.random().toString(36).substring(2, 9)}`;
}

const PROMPTS = [
  "What's in season right now in Sonoma?",
  "Pair a wine with dry-farmed heirloom tomatoes",
  "Best under-the-radar spots in Healdsburg?",
  "What makes Dry Creek Kitchen worth it?",
];

async function createConversation(apiUrl: string): Promise<number> {
  const res = await fetch(`${apiUrl}api/openai/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Sonoma Chef Mobile" }),
  });
  if (!res.ok) throw new Error("Failed to create conversation");
  const data = await res.json();
  return data.id;
}

async function streamMessage(
  apiUrl: string,
  conversationId: number,
  content: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const res = await fetch(
    `${apiUrl}api/openai/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ content }),
    }
  );

  if (!res.ok || !res.body) throw new Error("Failed to send message");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.done) return;
        if (data.content) onChunk(data.content);
      } catch (parseErr) {
        if (__DEV__) {
          console.warn("[Chef SSE] Failed to parse event line:", line, parseErr);
        }
      }
    }
  }
}

function TypingIndicator() {
  const colors = useColors();
  return (
    <View style={[styles.assistantBubble, { backgroundColor: colors.card }]}>
      <View style={styles.typingDots}>
        <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
        <View style={[styles.dot, styles.dotDelay1, { backgroundColor: colors.mutedForeground }]} />
        <View style={[styles.dot, styles.dotDelay2, { backgroundColor: colors.mutedForeground }]} />
      </View>
    </View>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const colors = useColors();
  const isUser = msg.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.avatarDot, { backgroundColor: colors.primary }]}>
          <Ionicons name="restaurant" size={12} color={colors.primaryForeground} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }],
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

export default function ChefScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const inputRef = useRef<TextInput>(null);

  const apiUrl = getApiUrl().replace(/\/?$/, "/");

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (conversationId) return conversationId;
    const id = await createConversation(apiUrl);
    setConversationId(id);
    return id;
  }, [conversationId, apiUrl]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInput("");
      setIsStreaming(true);
      setShowTyping(true);

      const userMsg: Message = { id: generateId(), role: "user", content: trimmed };
      setMessages((prev) => [userMsg, ...prev]);

      let assistantId = generateId();
      let firstChunk = true;

      try {
        const id = await ensureConversation();
        await streamMessage(apiUrl, id, trimmed, (chunk) => {
          if (firstChunk) {
            setShowTyping(false);
            setMessages((prev) => [
              { id: assistantId, role: "assistant", content: chunk },
              ...prev,
            ]);
            firstChunk = false;
          } else {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[0]?.id === assistantId) {
                updated[0] = { ...updated[0], content: updated[0].content + chunk };
              }
              return updated;
            });
          }
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        setShowTyping(false);
        setMessages((prev) => [
          {
            id: generateId(),
            role: "assistant",
            content: "Something went wrong. Give it a moment and try again.",
          },
          ...prev,
        ]);
      } finally {
        setIsStreaming(false);
        setShowTyping(false);
        inputRef.current?.focus();
      }
    },
    [isStreaming, ensureConversation, apiUrl]
  );

  const resetChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setInput("");
  }, []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
      testID="chef-screen"
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: topInset + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View style={[styles.chefAvatar, { backgroundColor: colors.primary }]}>
            <Ionicons name="restaurant" size={18} color={colors.primaryForeground} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Sonoma Chef</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
              Culinary authority
            </Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={resetChat} style={styles.resetBtn} testID="reset-chat">
              <Ionicons name="refresh-outline" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        inverted={messages.length > 0}
        contentContainerStyle={[
          styles.messageList,
          { paddingBottom: 12 },
        ]}
        ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={messages.length > 0}
        ListFooterComponent={
          messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.wineRedLight }]}>
                <Ionicons name="restaurant" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Ask the Sonoma Chef
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                The land. The labor. The flavor.
              </Text>
              <View style={styles.promptsGrid}>
                {PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.promptChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => handleSend(p)}
                    testID={`prompt-${p.substring(0, 20)}`}
                  >
                    <Text style={[styles.promptText, { color: colors.foreground }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null
        }
      />

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: bottomInset + 8,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Ask about wineries, farms, pairings…"
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          multiline
          blurOnSubmit={false}
          onSubmitEditing={() => handleSend(input)}
          editable={!isStreaming}
          testID="chef-input"
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: colors.primary,
              opacity: !input.trim() || isStreaming ? 0.4 : 1,
            },
          ]}
          onPress={() => {
            handleSend(input);
            inputRef.current?.focus();
          }}
          disabled={!input.trim() || isStreaming}
          testID="send-btn"
        >
          {isStreaming ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.primaryForeground} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chefAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resetBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 10,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    padding: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    opacity: 0.6,
  },
  dotDelay1: {
    opacity: 0.4,
  },
  dotDelay2: {
    opacity: 0.2,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  promptsGrid: {
    width: "100%",
    gap: 8,
  },
  promptChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  promptText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
