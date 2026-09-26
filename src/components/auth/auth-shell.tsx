"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, CalendarClock, Layers } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { CoverWall } from "@/components/auth/cover-wall";
import { ReaderPass, type PassStage } from "@/components/auth/reader-pass";

interface PassState {
  username: string;
  displayName?: string;
  stage: PassStage;
}

const PassContext = createContext<(state: PassState | null) => void>(() => {});

/** Pages inside the shell call this to show the reader's pass beside (or above) their form; pass null to remove it. */
export function useReaderPass(state: PassState | null) {
  const setPass = useContext(PassContext);
  const username = state?.username;
  const displayName = state?.displayName;
  const stage = state?.stage;
  useEffect(() => {
    setPass(username === undefined || stage === undefined ? null : { username, displayName, stage });
  }, [setPass, username, displayName, stage]);
  useEffect(() => () => setPass(null), [setPass]);
}

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={className ?? "inline-flex items-center gap-2.5"} aria-label="LUNEX TEAM">
      <Image src="/brand/icon-square.png" alt="" width={44} height={44} className="rounded-full ring-2 ring-primary-400/40" priority />
      <span className="font-display text-xl font-bold text-white">
        LUNEX <span className="text-primary-400">TEAM</span>
      </span>
    </Link>
  );
}

/**
 * The front door: a form column and, on large screens, a showcase beside it — a wall of covers, the pitch and,
 * on the sign-up page, the reader's pass taking shape as the person types. On phones the covers sit dimmed
 * behind the form and the pass sits above it.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const { series, stats } = useCatalog();
  const [pass, setPass] = useState<PassState | null>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  const real = series.filter((s) => s.cover.startsWith("/api/catalog/")).length;
  const facts = [
    real > 0 && { icon: Layers, text: `${real} عملًا مترجمًا` },
    stats.chapters > 0 && { icon: BookOpen, text: `${stats.chapters} فصلًا` },
    { icon: CalendarClock, text: "تحديثات أسبوعية" },
  ].filter(Boolean) as { icon: typeof Layers; text: string }[];

  // The pass leans toward the pointer. Skipped for touch and for people who ask for less motion.
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = tiltRef.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${(-x * 14).toFixed(2)}deg) rotateX(${(y * 10).toFixed(2)}deg)`;
  }, []);
  const onPointerLeave = useCallback(() => {
    if (tiltRef.current) tiltRef.current.style.transform = "";
  }, []);

  return (
    <PassContext.Provider value={setPass}>
      <div className="relative min-h-dvh overflow-hidden bg-background">
        {/* phones and tablets: the covers behind everything, dimmed */}
        <div className="absolute inset-0 lg:hidden" aria-hidden>
          <CoverWall columns={2} className="opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/85 to-background" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-lunex-radial" aria-hidden />

        <div className="relative mx-auto grid min-h-dvh lg:grid-cols-[minmax(440px,540px)_minmax(0,1fr)]">
          <main className="relative z-10 flex flex-col justify-center gap-6 px-4 py-8 sm:px-8 lg:px-12">
            <Brand className="inline-flex items-center gap-2.5 self-center lg:self-start" />

            {pass && (
              <div className="mx-auto w-full max-w-[320px] lg:hidden">
                <ReaderPass username={pass.username} displayName={pass.displayName} stage={pass.stage} />
              </div>
            )}

            <div className="mx-auto w-full max-w-md lg:mx-0">{children}</div>
          </main>

          <aside className="relative hidden overflow-hidden border-s border-white/10 lg:block" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
            <CoverWall />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-background/60 rtl:bg-gradient-to-l" aria-hidden />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" aria-hidden />
            <div className="pointer-events-none absolute start-1/4 top-1/3 h-72 w-72 rounded-full bg-primary-500/25 blur-3xl" aria-hidden />

            <div className="relative flex h-full flex-col items-center justify-center gap-10 p-12">
              {pass && (
                <div ref={tiltRef} className="w-full max-w-[400px] transition-transform duration-200 ease-out will-change-transform">
                  <div className="animate-bob">
                    <ReaderPass username={pass.username} displayName={pass.displayName} stage={pass.stage} />
                  </div>
                </div>
              )}

              <div className="max-w-md space-y-4 self-start text-start">
                <h2 className="font-display text-4xl font-extrabold leading-tight text-white text-balance">
                  مكتبة المانهوا المترجمة <span className="text-primary-300">خلف هذه البوابة</span>
                </h2>
                <p className="leading-relaxed text-white/75">حساب واحد يفتح لك الأعمال، ويحفظ مكانك في كل فصل، ويبقى تقدّمك معك أينما قرأت.</p>
                <ul className="flex flex-wrap gap-2 pt-1">
                  {facts.map(({ icon: Icon, text }) => (
                    <li key={text} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                      <Icon className="h-3.5 w-3.5 text-primary-300" /> {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PassContext.Provider>
  );
}
