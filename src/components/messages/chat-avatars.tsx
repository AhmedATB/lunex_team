"use client";

import Image from "next/image";
import { Users } from "lucide-react";
import type { Conversation, Person } from "@/lib/messages-api";
import { resolveAvatarUrl } from "@/lib/utils";

export function PersonAvatar({ person, size }: { person: Person; size: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-full ring-2 ring-primary-500/30" style={{ width: size, height: size }}>
      <Image src={resolveAvatarUrl(person.id, person.avatarVersion, person.id)} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
    </span>
  );
}

/** A group's picture (or, without one, the group symbol); the other person's picture in a chat between two. */
export function ChatAvatar({ conversation, myId, size }: { conversation: Conversation; myId: string | null; size: number }) {
  const other = conversation.members.find((m) => m.id !== myId);
  if (conversation.isGroup && conversation.photoVersion) {
    return (
      <span className="relative shrink-0 overflow-hidden rounded-full ring-2 ring-primary-500/30" style={{ width: size, height: size }}>
        <Image
          src={`/api/conversations/${encodeURIComponent(conversation.id)}/photo?v=${encodeURIComponent(conversation.photoVersion)}`}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      </span>
    );
  }
  if (conversation.isGroup || !other) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-primary-200 ring-2 ring-primary-500/30" style={{ width: size, height: size }}>
        <Users className="h-1/2 w-1/2" aria-hidden />
      </span>
    );
  }
  return <PersonAvatar person={other} size={size} />;
}
