import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";
import type { User } from "@/lib/types";
import { avatarUrl, formatNumber } from "@/lib/utils";

const MEDAL_COLORS = ["text-amber-300", "text-slate-300", "text-orange-400"];

export function TopReaders({ users }: { users: User[] }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold text-white sm:text-2xl">أفضل القرّاء</h2>
      <div className="panel">
        {users.slice(0, 8).map((u, i) => (
          <Link
            key={u.id}
            href={`/profile/${u.username}`}
            className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0 transition-colors hover:bg-white/5"
          >
            <span className="w-5 text-center font-display text-sm font-bold text-lunex-gray">
              {i < 3 ? <Trophy className={`mx-auto h-4 w-4 ${MEDAL_COLORS[i]}`} /> : i + 1}
            </span>
            <div className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-white/10">
              <Image src={avatarUrl(u.avatarSeed)} alt={u.displayName} fill className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{u.displayName}</p>
              <p className="text-xs text-lunex-gray">مستوى {u.level}</p>
            </div>
            <span className="text-xs font-semibold text-primary-300">{formatNumber(u.readCount)} فصل</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
