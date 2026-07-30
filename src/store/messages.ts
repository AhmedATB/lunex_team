"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  at: string;
}

export interface Conversation {
  id: string;
  participantIds: [string, string];
  messages: ChatMessage[];
}

interface MessagesState {
  conversations: Record<string, Conversation>;
  /** conversationId -> userIds who have unread messages there. */
  unreadBy: Record<string, string[]>;

  sendMessage: (fromUserId: string, toUserId: string, text: string) => void;
  markRead: (conversationId: string, userId: string) => void;
}

/** Canonical, order-independent id for a two-person conversation. */
export function conversationId(userA: string, userB: string): string {
  return [userA, userB].sort().join("::");
}

export const useMessages = create<MessagesState>()(
  persist(
    (set) => ({
      conversations: {},
      unreadBy: {},

      sendMessage: (fromUserId, toUserId, text) => {
        if (!text.trim() || fromUserId === toUserId) return;
        const id = conversationId(fromUserId, toUserId);
        const message: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          senderId: fromUserId,
          text: text.trim(),
          at: new Date().toISOString(),
        };
        set((s) => {
          const existing = s.conversations[id];
          const conversation: Conversation = existing
            ? { ...existing, messages: [...existing.messages, message] }
            : { id, participantIds: [fromUserId, toUserId], messages: [message] };
          const unread = new Set(s.unreadBy[id] ?? []);
          unread.add(toUserId);
          unread.delete(fromUserId);
          return {
            conversations: { ...s.conversations, [id]: conversation },
            unreadBy: { ...s.unreadBy, [id]: [...unread] },
          };
        });
      },

      markRead: (conversationId, userId) => {
        set((s) => {
          const unread = (s.unreadBy[conversationId] ?? []).filter((id) => id !== userId);
          return { unreadBy: { ...s.unreadBy, [conversationId]: unread } };
        });
      },
    }),
    { name: "lunex-messages", skipHydration: true }
  )
);
