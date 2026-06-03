import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface RideMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: string;
  originalMessage: string;
  translatedMessage?: string | null;
  createdAt: string;
}

interface QuickReply {
  key: string;
  text: string;
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

interface RideChatProps {
  rideId: string;
  visible: boolean;
  onClose: () => void;
  myUserId: string;
  otherPartyName: string;
}

interface RideConversationProps {
  rideId: string;
  myUserId: string;
  otherPartyName: string;
  // Controls background polling. Modal passes its `visible`; the embedded
  // full-screen version is always active.
  active?: boolean;
  // Inline full-screen (Messages screen) vs. bottom-sheet modal chrome.
  embedded?: boolean;
  // When provided, a close button is shown in the header (modal use).
  onClose?: () => void;
  topInset?: number;
  bottomInset?: number;
  keyboardOffset?: number;
}

const LANG_KEY = "@travony_chat_lang";

// Shown only until the localized quick replies load from the server.
const FALLBACK_QUICK: QuickReply[] = [
  { key: "on_my_way", text: "On my way!" },
  { key: "im_here", text: "I'm here at the pickup point" },
  { key: "2_minutes", text: "I'll be there in 2 minutes" },
  { key: "wait_please", text: "Please wait, I'm coming" },
  { key: "looking_for_you", text: "I'm looking for you" },
];

async function syncLanguageToServer(code: string) {
  try {
    await apiRequest(`/api/me/language`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: code }),
    });
  } catch {
    // Best-effort: the other party just falls back to English translations.
  }
}

/**
 * The full chat conversation UI (message list, quick replies, composer, and
 * language picker) without any surrounding modal chrome. Used both inside the
 * RideChat bottom-sheet modal and embedded full-screen on the Messages screen.
 */
export function RideConversation({
  rideId,
  myUserId,
  otherPartyName,
  active = true,
  embedded = false,
  onClose,
  topInset = 0,
  bottomInset,
  keyboardOffset = 0,
}: RideConversationProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<RideMessage>>(null);
  const [text, setText] = useState("");
  const [myLang, setMyLang] = useState("en");
  const [showLangPicker, setShowLangPicker] = useState(false);

  const messagesKey = ["/api/rides", rideId, "messages"];

  // Load the saved language once and make sure the server knows it so the other
  // side can translate their messages into the language this user speaks.
  useEffect(() => {
    let isActive = true;
    AsyncStorage.getItem(LANG_KEY).then((stored) => {
      const lang = stored || "en";
      if (isActive && stored) setMyLang(stored);
      syncLanguageToServer(lang);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const { data: messages, isLoading } = useQuery<RideMessage[]>({
    queryKey: messagesKey,
    enabled: active && !!rideId,
    refetchInterval: active ? 4000 : false,
  });

  const { data: quickReplies } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies", myLang],
    enabled: active,
  });

  const { data: languages } = useQuery<Language[]>({
    queryKey: ["/api/languages"],
    enabled: active,
  });

  const sendMutation = useMutation({
    mutationFn: (payload: { message: string; isQuickReply: boolean }) =>
      apiRequest(`/api/rides/${rideId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: payload.message,
          senderLanguage: myLang,
          isQuickReply: payload.isQuickReply,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKey });
    },
    onError: (_error, payload) => {
      // Restore typed text so a message is never silently lost. Quick replies
      // have nothing to restore (they are re-tappable), so just alert.
      if (!payload.isQuickReply) {
        setText((current) => (current.trim().length > 0 ? current : payload.message));
      }
      Alert.alert(
        "Message not sent",
        "We couldn't deliver your message. Please check your connection and try again.",
      );
    },
  });

  useEffect(() => {
    if (active && messages && messages.length > 0) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return () => clearTimeout(t);
    }
  }, [messages, active]);

  const handleSendText = () => {
    const body = text.trim();
    if (!body || sendMutation.isPending) return;
    setText("");
    sendMutation.mutate({ message: body, isQuickReply: false });
  };

  const handleQuickReply = (key: string) => {
    if (sendMutation.isPending) return;
    sendMutation.mutate({ message: key, isQuickReply: true });
  };

  const changeLanguage = (code: string) => {
    setMyLang(code);
    setShowLangPicker(false);
    AsyncStorage.setItem(LANG_KEY, code).catch(() => {});
    syncLanguageToServer(code);
    queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
  };

  const renderItem = ({ item }: { item: RideMessage }) => {
    const isMine = item.senderId === myUserId;
    const display = isMine
      ? item.originalMessage
      : item.translatedMessage || item.originalMessage;
    return (
      <View
        style={[
          styles.bubbleRow,
          { justifyContent: isMine ? "flex-end" : "flex-start" },
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMine
              ? { backgroundColor: theme.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: theme.card, borderBottomLeftRadius: 4 },
          ]}
        >
          <ThemedText
            style={[
              styles.bubbleText,
              { color: isMine ? "#FFFFFF" : theme.text },
            ]}
          >
            {display}
          </ThemedText>
        </View>
      </View>
    );
  };

  const chips = quickReplies && quickReplies.length > 0 ? quickReplies : FALLBACK_QUICK;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardOffset}
      style={[
        embedded ? styles.embedded : styles.sheet,
        {
          backgroundColor: theme.backgroundRoot,
          paddingTop: topInset,
          paddingBottom: (bottomInset ?? insets.bottom) + Spacing.sm,
        },
      ]}
    >
      {!embedded ? <View style={styles.handle} /> : null}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>{otherPartyName}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Messages stay in your trip
          </ThemedText>
        </View>
        <Pressable
          onPress={() => setShowLangPicker(true)}
          style={[styles.langBtn, { backgroundColor: theme.card }]}
          hitSlop={8}
        >
          <Ionicons name="language" size={16} color={theme.primary} />
          <ThemedText style={[styles.langCode, { color: theme.text }]}>
            {myLang.toUpperCase()}
          </ThemedText>
        </Pressable>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.card }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages || []}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="chatbubbles-outline"
                size={40}
                color={theme.textMuted}
              />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Say hello to {otherPartyName}
              </ThemedText>
            </View>
          }
        />
      )}

      <FlatList
        data={chips}
        horizontal
        keyExtractor={(q) => q.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickRow}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleQuickReply(item.key)}
            style={[styles.quickChip, { backgroundColor: theme.card }]}
          >
            <ThemedText style={[styles.quickText, { color: theme.text }]}>
              {item.text}
            </ThemedText>
          </Pressable>
        )}
      />

      <View style={[styles.inputRow, { borderTopColor: theme.card }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            { backgroundColor: theme.card, color: theme.text },
          ]}
          multiline
          onSubmitEditing={handleSendText}
          returnKeyType="send"
        />
        <Pressable
          onPress={handleSendText}
          disabled={!text.trim() || sendMutation.isPending}
          style={[
            styles.sendBtn,
            {
              backgroundColor: text.trim() ? theme.primary : theme.card,
              opacity: sendMutation.isPending ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons
            name="send"
            size={20}
            color={text.trim() ? "#FFFFFF" : theme.textMuted}
          />
        </Pressable>
      </View>

      <Modal
        visible={showLangPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLangPicker(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTouch} onPress={() => setShowLangPicker(false)} />
          <View
            style={[
              styles.langSheet,
              { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.lg },
            ]}
          >
            <View style={styles.handle} />
            <ThemedText style={styles.langTitle}>The language you speak</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
              Quick replies and messages will be shown to you in this language.
            </ThemedText>
            <FlatList
              data={languages || []}
              keyExtractor={(l) => l.code}
              renderItem={({ item }) => {
                const selected = item.code === myLang;
                return (
                  <Pressable
                    onPress={() => changeLanguage(item.code)}
                    style={[
                      styles.langRow,
                      { backgroundColor: selected ? theme.primary : theme.card },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText
                        style={[styles.langNative, { color: selected ? "#FFFFFF" : theme.text }]}
                      >
                        {item.nativeName}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.langName,
                          { color: selected ? "rgba(255,255,255,0.8)" : theme.textSecondary },
                        ]}
                      >
                        {item.name}
                      </ThemedText>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/**
 * Bottom-sheet modal wrapper around RideConversation, used on the active-ride
 * screens via a "Chat" button.
 */
export function RideChat({ rideId, visible, onClose, myUserId, otherPartyName }: RideChatProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <RideConversation
          rideId={rideId}
          myUserId={myUserId}
          otherPartyName={otherPartyName}
          active={visible}
          onClose={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  backdropTouch: { flex: 1 },
  sheet: {
    height: "78%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
  },
  embedded: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.4)",
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 11, marginTop: 2 },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: Spacing.sm,
    borderRadius: 18,
  },
  langCode: { fontSize: 12, fontWeight: "700" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: Spacing["2xl"] },
  emptyText: { marginTop: Spacing.sm, fontSize: 14 },
  listContent: { flexGrow: 1, paddingVertical: Spacing.sm },
  bubbleRow: { flexDirection: "row", marginVertical: 3 },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  quickRow: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  quickChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  quickText: { fontSize: 12, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === "ios" ? 12 : 8,
    paddingBottom: Platform.OS === "ios" ? 12 : 8,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  langSheet: {
    maxHeight: "70%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
  },
  langTitle: { fontSize: 17, fontWeight: "700", marginTop: Spacing.xs },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  langNative: { fontSize: 15, fontWeight: "600" },
  langName: { fontSize: 12, marginTop: 2 },
});
