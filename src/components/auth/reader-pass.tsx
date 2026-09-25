"use client";

import Image from "next/image";
import { Check, Loader2 } from "lucide-react";
import { generatedAvatarUri } from "@/lib/generated-avatar";
import { cn } from "@/lib/utils";

export type PassStage = "draft" | "minting" | "sealed";

/** 32-bit FNV-1a — the same small hash the default avatars use, so a name always maps to the same number. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "LNX-4827": stable for a given name, obviously not a real registry number. */
export function memberNumber(username: string): string {
  return username ? `LNX-${1000 + (hash(username.toLowerCase()) % 9000)}` : "LNX-····";
}

/**
 * A crescent drawn with straight edges only — the brand's gem-cut moon, never a smooth one. Two circles, one
 * cut out of the other; each arc is walked in `steps` flat segments between the points where they cross.
 */
function crescentPath(steps = 9): string {
  const R = 46; // the moon
  const r = 38; // the bite taken out of it
  const cx = 17; // where the bite is centred, relative to the moon
  const cy = -5;
  const d = Math.hypot(cx, cy);
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(R * R - a * a);
  const ux = cx / d;
  const uy = cy / d;
  const mx = ux * a;
  const my = uy * a;
  const p1 = { x: mx + h * uy, y: my - h * ux };
  const p2 = { x: mx - h * uy, y: my + h * ux };

  const angle = (c: { x: number; y: number }, p: { x: number; y: number }) => Math.atan2(p.y - c.y, p.x - c.x);
  const TAU = Math.PI * 2;
  /** Of the two ways round a circle between two angles, the one whose middle point satisfies `wanted`. */
  const sweepWhere = (centre: { x: number; y: number }, radius: number, from: number, to: number, wanted: (x: number, y: number) => boolean) => {
    const direct = ((to - from + Math.PI * 3) % TAU) - Math.PI; // -π..π
    const other = direct > 0 ? direct - TAU : direct + TAU;
    const middle = (sweep: number) => [centre.x + radius * Math.cos(from + sweep / 2), centre.y + radius * Math.sin(from + sweep / 2)] as const;
    return wanted(...middle(direct)) ? direct : other;
  };

  // The moon's own edge, on the side away from the bite.
  const outerFrom = angle({ x: 0, y: 0 }, p1);
  const outerSweep = sweepWhere({ x: 0, y: 0 }, R, outerFrom, angle({ x: 0, y: 0 }, p2), (x, y) => Math.hypot(x - cx, y - cy) > r);

  // The bite's edge, on the side that lies inside the moon.
  const bite = { x: cx, y: cy };
  const innerFrom = angle(bite, p2);
  const innerSweep = sweepWhere(bite, r, innerFrom, angle(bite, p1), (x, y) => Math.hypot(x, y) < R);

  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = outerFrom + (outerSweep * i) / steps;
    points.push(`${(R * Math.cos(t)).toFixed(1)},${(R * Math.sin(t)).toFixed(1)}`);
  }
  for (let i = 0; i <= steps; i++) {
    const t = innerFrom + (innerSweep * i) / steps;
    points.push(`${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`);
  }
  return points.join(" ");
}

const CRESCENT = crescentPath();

/** Every third corner of the moon, joined to its centre — the cut lines of the gem. */
const FACETS = CRESCENT.split(" ")
  .filter((_, i) => i % 3 === 0)
  .map((point) => point.split(","));

/** A four-point sparkle, the brand's accent shape. */
const SPARKLE = "0,-9 2.2,-2.2 9,0 2.2,2.2 0,9 -2.2,2.2 -9,0 -2.2,-2.2";

/**
 * The reader's pass: the sign-up form mints it as the person types. It follows the theme through the
 * primary colour tokens, and everything on it is drawn here (no image is fetched).
 */
export function ReaderPass({ username, stage = "draft", className }: { username: string; stage?: PassStage; className?: string }) {
  const name = username.trim();
  const number = memberNumber(name);

  return (
    <div
      className={cn(
        "relative aspect-[1.586] w-full select-none overflow-hidden rounded-[1.4rem] border border-white/20 text-white shadow-glow-lg",
        "bg-[linear-gradient(135deg,rgb(var(--primary-700))_0%,rgb(var(--primary-500))_52%,rgb(var(--primary-300))_120%)]",
        className
      )}
      role="img"
      aria-label={name ? `بطاقة القارئ باسم ${name}، رقم العضوية ${number}` : "بطاقة القارئ، لم يُكتب الاسم بعد"}
    >
      {/* shade the lower half so the text stays readable on every theme */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,rgb(0_0_0/0.5)_100%)]" />

      {/* gem-cut moon and crystal facets */}
      <svg viewBox="-60 -60 120 120" className="absolute -end-6 -top-8 h-[78%] w-auto opacity-90" aria-hidden>
        <polygon points={CRESCENT} fill="rgb(255 255 255 / 0.1)" stroke="rgb(255 255 255 / 0.75)" strokeWidth="0.9" strokeLinejoin="round" />
        {FACETS.map(([x, y]) => (
          <line key={`${x},${y}`} x1="0" y1="0" x2={x} y2={y} stroke="rgb(255 255 255 / 0.12)" strokeWidth="0.5" />
        ))}
        <polygon points={SPARKLE} transform="translate(-40 34)" fill="white" opacity="0.9" />
        <polygon points={SPARKLE} transform="translate(44 30) scale(0.55)" fill="white" opacity="0.7" />
      </svg>

      <div className="relative flex h-full flex-col justify-between p-[6%]">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[0.7rem] font-bold tracking-[0.22em]">
            <Image src="/brand/logo-white.png" alt="" width={18} height={18} className="h-[1.1rem] w-[1.1rem] object-contain" />
            LUNEX
          </span>
          <span className="rounded-full border border-white/30 bg-black/20 px-2.5 py-0.5 text-[0.65rem] font-bold backdrop-blur-sm">بطاقة القارئ</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="relative h-[3.6rem] w-[3.6rem] shrink-0 overflow-hidden rounded-full ring-2 ring-white/70 sm:h-16 sm:w-16">
            <Image src={generatedAvatarUri(name || "lunex")} alt="" fill sizes="64px" className="object-cover" unoptimized />
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] text-white/75">الاسم</p>
            <p dir="ltr" className={cn("truncate text-start font-display text-xl font-bold leading-tight sm:text-2xl", !name && "text-white/45")}>
              {name || "username"}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 text-[0.7rem]">
          <div>
            <p className="text-white/70">رقم العضوية</p>
            <p dir="ltr" className="text-start font-mono text-sm font-bold tracking-widest">
              {number}
            </p>
          </div>
          <p className="text-end text-white/85">
            <span className="font-bold">قارئ</span> · المستوى 1
          </p>
        </div>
      </div>

      {/* the seal: stamped once the account exists */}
      {stage === "sealed" && (
        <span className="seal-in absolute bottom-[10%] end-[8%] grid h-[4.6rem] w-[4.6rem] place-items-center rounded-full border-2 border-white bg-black/35 text-white shadow-lg backdrop-blur-sm" aria-hidden>
          <span className="absolute inset-1 rounded-full border border-dashed border-white/70" />
          <span className="flex flex-col items-center text-[0.6rem] font-extrabold leading-tight">
            <Check className="mb-0.5 h-5 w-5" strokeWidth={3} />
            مختومة
          </span>
        </span>
      )}

      {/* a pass of light crosses the card whenever it changes state */}
      <span key={stage} className={cn("pass-sheen pointer-events-none absolute inset-y-0 start-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent", stage === "draft" && "opacity-0")} aria-hidden />

      {stage === "minting" && (
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/45 py-1.5 text-[0.7rem] font-bold backdrop-blur-sm" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري ختم بطاقتك...
        </span>
      )}
    </div>
  );
}
