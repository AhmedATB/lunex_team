"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Loader2, Search, X } from "lucide-react";
import { searchPeople, type Person } from "@/lib/messages-api";
import { resolveAvatarUrl, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const MIN_CHARS = 1;
const DEBOUNCE_MS = 250;

function Avatar({ person, size }: { person: Person; size: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-full bg-white/10" style={{ width: size, height: size }}>
      <Image src={resolveAvatarUrl(person.id, person.avatarVersion, person.id)} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
    </span>
  );
}

/**
 * Type a name or a username and the matching members appear; pick one or several. The picked ones sit above as chips that
 * can be removed. Used to start a chat (one person = a direct chat, two or more = a group).
 */
export function UserPicker({
  selected,
  onChange,
  excludeIds = [],
  max = 19,
  autoFocus = false,
}: {
  selected: Person[];
  onChange: (people: Person[]) => void;
  excludeIds?: string[];
  max?: number;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(0);

  useEffect(() => {
    const term = query.trim().replace(/^@/, "");
    if (term.length < MIN_CHARS) {
      setResults([]);
      setError("");
      return;
    }
    const ticket = ++latest.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const result = await searchPeople(term);
      if (ticket !== latest.current) return; // a newer search is already running
      setLoading(false);
      if (result.ok) {
        setResults(result.body);
        setError("");
      } else {
        setResults([]);
        setError(result.message);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const isPicked = (id: string) => selected.some((p) => p.id === id);
  const visible = results.filter((p) => !excludeIds.includes(p.id));

  function toggle(person: Person) {
    if (isPicked(person.id)) onChange(selected.filter((p) => p.id !== person.id));
    else if (selected.length < max) onChange([...selected, person]);
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="المختارون">
          {selected.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-full border border-primary-400/40 bg-primary-500/15 py-0.5 pe-1 ps-0.5 text-xs text-white">
              <Avatar person={p} size={20} />
              {p.displayName}
              <button type="button" onClick={() => toggle(p)} aria-label={`إزالة ${p.displayName}`} className="rounded-full p-0.5 hover:bg-white/15">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اكتب اسمًا أو اسم مستخدم..."
          className="ps-9"
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label="ابحث عن أشخاص"
        />
        {loading && <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-lunex-gray" />}
      </div>

      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}

      {query.trim() && !loading && !error && visible.length === 0 && <p className="px-1 text-xs text-lunex-gray">لا يوجد أحد بهذا الاسم.</p>}

      {visible.length > 0 && (
        <ul className="max-h-60 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10" role="listbox" aria-multiselectable>
          {visible.map((p) => {
            const picked = isPicked(p.id);
            return (
              <li key={p.id} role="option" aria-selected={picked}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  className={cn("flex w-full items-center gap-3 p-2.5 text-start transition-colors hover:bg-white/5", picked && "bg-primary-500/10")}
                >
                  <Avatar person={p} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{p.displayName}</span>
                    <span dir="ltr" className="block truncate text-start text-xs text-lunex-gray">@{p.username}</span>
                  </span>
                  {picked && <Check className="h-4 w-4 shrink-0 text-primary-300" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
