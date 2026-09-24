import { cn } from "@/lib/utils";

/** Placeholder block. Server-safe (no hooks), so `loading.tsx` files and client pages can both use it. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl border border-white/5 bg-white/[0.09] motion-reduce:animate-none", className)} />;
}

function Busy({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label="جاري التحميل" className={className}>
      {children}
    </div>
  );
}

function SectionTitle() {
  return <Skeleton className="h-7 w-48" />;
}

function CoverGrid({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Mirrors the homepage: lead + side stories, stat strip, numbered list, update grid, carousel, cover grid. */
export function HomeSkeleton() {
  return (
    <Busy className="container space-y-14 py-6">
      <div className="flex flex-col gap-4 lg:h-[400px] lg:flex-row">
        <Skeleton className="min-h-[320px] flex-1 rounded-2xl lg:flex-[1.7]" />
        <div className="flex gap-3 overflow-hidden lg:flex-1 lg:flex-col">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-64 shrink-0 rounded-2xl lg:h-auto lg:w-auto lg:flex-1" />
          ))}
        </div>
      </div>

      <Skeleton className="h-16 rounded-2xl" />

      <section className="space-y-4">
        <SectionTitle />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-11 shrink-0" />
              <Skeleton className="h-[66px] w-[50px] shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="col-span-2 row-span-2 min-h-[220px] rounded-2xl sm:min-h-[280px]" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="min-h-[130px] rounded-2xl" />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="w-40 shrink-0 space-y-2 sm:w-48">
              <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle />
        <CoverGrid count={6} />
      </section>
    </Busy>
  );
}

/** Generic listing page: title, toolbar, cover grid. The fallback for every page without a more specific skeleton. */
export function GridPageSkeleton() {
  return (
    <Busy className="container space-y-6 py-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-11 w-full max-w-md" />
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-28" />
      </div>
      <CoverGrid count={12} />
    </Busy>
  );
}

/** Mirrors a series page: banner, cover + details, then chapter list beside a side column. */
export function SeriesDetailSkeleton() {
  return (
    <Busy>
      <Skeleton className="h-64 w-full rounded-none sm:h-80" />
      <div className="container relative z-10 -mt-24 space-y-8 sm:-mt-28">
        <div className="flex flex-col gap-6 sm:flex-row">
          <Skeleton className="h-64 w-44 shrink-0 rounded-2xl sm:h-72 sm:w-52" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-11 w-36" />
              <Skeleton className="h-11 w-28" />
            </div>
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <Skeleton className="h-7 w-40" />
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** Mirrors a team / user profile: banner, avatar + name, tab row, cards. */
export function ProfileSkeleton() {
  return (
    <Busy>
      <Skeleton className="h-48 w-full rounded-none sm:h-60" />
      <div className="container -mt-14 space-y-6">
        <div className="flex items-end gap-4">
          <Skeleton className="h-28 w-28 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pb-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    </Busy>
  );
}

/** Mirrors the chapter reader: toolbar, then tall page placeholders on black. */
export function ReaderSkeleton() {
  return (
    <Busy className="min-h-screen bg-black">
      <div className="flex h-14 items-center justify-between gap-3 border-b border-white/10 px-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="mx-auto max-w-3xl space-y-2">
        <Skeleton className="aspect-[2/3] w-full rounded-none" />
        <Skeleton className="aspect-[2/3] w-full rounded-none" />
      </div>
    </Busy>
  );
}
