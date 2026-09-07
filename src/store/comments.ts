"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Comment } from "@/lib/types";

export interface CommentOverride {
  isPinned?: boolean;
  isSpoiler?: boolean;
  content?: string;
  editedAt?: string;
}

export interface CommentReport {
  reporterId: string;
  reason: string;
  at: string;
}

interface CommentsState {
  addedComments: Comment[];
  removedCommentIds: string[];
  overrides: Record<string, CommentOverride>;
  reactions: Record<string, "like" | "dislike" | undefined>;
  reports: Record<string, CommentReport[]>;

  postComment: (
    input: Pick<Comment, "seriesId" | "userId" | "content" | "isSpoiler"> &
      Partial<Pick<Comment, "chapterId" | "parentId">>
  ) => void;
  editComment: (id: string, content: string) => void;
  deleteComment: (id: string) => void;
  setPinned: (id: string, pinned: boolean) => void;
  setSpoiler: (id: string, spoiler: boolean) => void;
  react: (id: string, kind: "like" | "dislike") => void;
  reportComment: (id: string, reporterId: string, reason: string) => void;
  dismissReports: (id: string) => void;
}

export const useComments = create<CommentsState>()(
  persist(
    (set) => ({
      addedComments: [],
      removedCommentIds: [],
      overrides: {},
      reactions: {},
      reports: {},

      postComment: (input) => {
        const comment: Comment = {
          id: `comment-added-${Date.now()}`,
          likes: 0,
          dislikes: 0,
          isPinned: false,
          createdAt: new Date().toISOString(),
          ...input,
        };
        set((s) => ({ addedComments: [comment, ...s.addedComments] }));
      },

      editComment: (id, content) => {
        set((s) => ({
          overrides: { ...s.overrides, [id]: { ...s.overrides[id], content, editedAt: new Date().toISOString() } },
        }));
      },

      deleteComment: (id) => {
        set((s) => ({ removedCommentIds: [...s.removedCommentIds, id] }));
      },

      setPinned: (id, pinned) => {
        set((s) => ({ overrides: { ...s.overrides, [id]: { ...s.overrides[id], isPinned: pinned } } }));
      },

      setSpoiler: (id, spoiler) => {
        set((s) => ({ overrides: { ...s.overrides, [id]: { ...s.overrides[id], isSpoiler: spoiler } } }));
      },

      react: (id, kind) => {
        set((s) => ({ reactions: { ...s.reactions, [id]: s.reactions[id] === kind ? undefined : kind } }));
      },

      reportComment: (id, reporterId, reason) => {
        set((s) => ({
          reports: {
            ...s.reports,
            [id]: [...(s.reports[id] ?? []).filter((r) => r.reporterId !== reporterId), { reporterId, reason, at: new Date().toISOString() }],
          },
        }));
      },

      dismissReports: (id) => {
        set((s) => {
          const next = { ...s.reports };
          delete next[id];
          return { reports: next };
        });
      },
    }),
    { name: "lunex-comments", skipHydration: true }
  )
);

/** Applies added/removed/edited comments on top of a base (mock) list — same shape as team-management's override triples. */
export function mergeComments(
  base: Comment[],
  state: Pick<CommentsState, "addedComments" | "removedCommentIds" | "overrides">
): Comment[] {
  const removed = new Set(state.removedCommentIds);
  return [...state.addedComments, ...base]
    .filter((c) => !removed.has(c.id))
    .map((c) => ({ ...c, ...state.overrides[c.id] }));
}
