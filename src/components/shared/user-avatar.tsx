"use client";

import Image from "next/image";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { avatarUrl, cn } from "@/lib/utils";

/** Renders a user's avatar respecting any avatar-picker override — usable from Server Components. */
export function UserAvatar({
  user,
  alt,
  className,
  sizes,
}: {
  user: { id: string; avatarSeed: string };
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  return (
    <Image
      src={avatarUrl(effectiveAvatarSeed(user, avatarOverrides))}
      alt={alt}
      fill
      sizes={sizes}
      className={cn("object-cover", className)}
    />
  );
}
