import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuthUser } from '@/lib/auth';
import { useMutation } from '@tanstack/react-query';
import { Send, Sparkles } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/theme';
import { coachChat } from '@/lib/api/ai';
import { isClerkConfigured } from '@/lib/config';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

const DEFAULT_PROMPTS = [
  'Why am I slicing my driver?',
  'What club from 145 yards?',
  'Give me a 20-minute range routine',
  'How do I stop three-putting?',
];

export default function CoachChatScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ prefill?: string }>();
  useAuthUser();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(params.prefill ?? '');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>(DEFAULT_PROMPTS);
  const listRef = useRef<FlatList<Msg>>(null);

  const send = useMutation({
    mutationFn: async (text: string) => {
      return coachChat(text, conversationId);
    },
    onSuccess: (res) => {
      setConversationId(res.conversationId);
      setSuggested(res.suggestedPrompts.length ? res.suggestedPrompts : suggested);
      setMessages((m) => [
        ...m.filter((x) => !x.pending),
        { id: `a-${Date.now()}`, role: 'assistant', content: res.reply },
      ]);
    },
    onError: () => {
      setMessages((m) => [
        ...m.filter((x) => !x.pending),
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: "I couldn't reach the coach service right now — check your connection and try again.",
        },
      ]);
    },
  });

  const sendMessage = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || send.isPending) return;
    setInput('');
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: 'user', content: t },
      { id: 'pending', role: 'assistant', content: 'Thinking…', pending: true },
    ]);
    send.mutate(t);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser ? (
          <View style={[styles.avatar, { backgroundColor: colors.forest }]}>
            <Sparkles size={12} color={colors.brass} />
          </View>
        ) : null}
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.forest, borderBottomRightRadius: 4 }
              : { backgroundColor: colors.bgRaised, borderBottomLeftRadius: 4 },
          ]}
        >
          <Text variant="body" style={{ color: isUser ? '#F7F4EC' : colors.text }}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title: 'Arcfore Coach', headerBackTitle: 'Back' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            messages.length === 0 ? (
              <View style={styles.intro}>
                <Text variant="h3" style={{ color: colors.forest }}>
                  Ask anything about your game.
                </Text>
                <Text variant="body" secondary>
                  The coach can see your profile, your bag, and your recorded rounds and analyses — it only
                  talks about data you've actually given it.
                </Text>
              </View>
            ) : (
              <View />
            )
          }
        />

        {/* suggested prompts */}
        {suggested.length > 0 && messages.length < 4 ? (
          <View style={styles.suggestWrap}>
            {suggested.map((p) => (
              <Chip key={p} label={p} onPress={() => sendMessage(p)} />
            ))}
          </View>
        ) : null}

        <View style={[styles.inputBar, { borderTopColor: colors.border }]}>
          <Input
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach…"
            style={{ flex: 1 }}
            dense
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            editable={!send.isPending}
          />
          <Pressable
            onPress={() => sendMessage()}
            disabled={!input.trim() || send.isPending || !isClerkConfigured()}
            style={[
              styles.sendBtn,
              { backgroundColor: colors.forest, opacity: input.trim() && !send.isPending ? 1 : 0.4 },
            ]}
            accessibilityLabel="Send message"
          >
            <Send size={18} color="#F7F4EC" />
          </Pressable>
        </View>
        {!isClerkConfigured() ? (
          <Text variant="micro" secondary center style={{ paddingBottom: 8 }}>
            Sign in and configure the Arcfore API to chat with the coach.
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  intro: { gap: spacing.sm, marginBottom: spacing.lg, marginTop: spacing.xl },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  msgRowUser: { justifyContent: 'flex-end' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  suggestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
