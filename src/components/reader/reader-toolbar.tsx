"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Maximize,
  Minimize,
  Settings2,
  Rows3,
  GalleryHorizontal,
  BookOpenText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReaderSettings, type ReaderMode, type ReaderFit } from "@/store/reader-settings";
import type { Chapter } from "@/lib/types";
import { cn } from "@/lib/utils";

const MODE_ICON: Record<ReaderMode, typeof Rows3> = {
  vertical: Rows3,
  horizontal: GalleryHorizontal,
  page: BookOpenText,
};

export function ReaderToolbar({
  seriesSlug,
  seriesTitle,
  chapter,
  chapters,
  prevChapter,
  nextChapter,
}: {
  seriesSlug: string;
  seriesTitle: string;
  chapter: Chapter;
  chapters: Chapter[];
  prevChapter?: number;
  nextChapter?: number;
}) {
  const router = useRouter();
  const settings = useReaderSettings();
  const [fullscreen, setFullscreen] = useState(false);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  const ModeIcon = MODE_ICON[settings.mode];

  return (
    <div className="sticky top-16 z-30 flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#09090B]/90 px-3 py-2 backdrop-blur-xl">
      <Link href={`/series/${seriesSlug}`} className="flex items-center gap-1 text-sm text-lunex-gray hover:text-white">
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        <span className="hidden max-w-[140px] truncate sm:inline">{seriesTitle}</span>
      </Link>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" disabled={!prevChapter} onClick={() => prevChapter && router.push(`/series/${seriesSlug}/${prevChapter}`)}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>

        <Select value={String(chapter.number)} onValueChange={(v) => router.push(`/series/${seriesSlug}/${v}`)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {chapters.map((c) => (
              <SelectItem key={c.id} value={String(c.number)}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" disabled={!nextChapter} onClick={() => nextChapter && router.push(`/series/${seriesSlug}/${nextChapter}`)}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      <div className="ms-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="reader-mode-menu-trigger" variant="ghost" size="icon"><ModeIcon className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>وضع القراءة</DropdownMenuLabel>
            {(["vertical", "horizontal", "page"] as ReaderMode[]).map((m) => (
              <button
                key={m}
                onClick={() => settings.setMode(m)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-primary-600/20",
                  settings.mode === m && "text-primary-300"
                )}
              >
                {m === "vertical" ? "عمودي متواصل" : m === "horizontal" ? "أفقي" : "صفحة بصفحة"}
              </button>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>ملاءمة الصورة</DropdownMenuLabel>
            {(["width", "height", "original"] as ReaderFit[]).map((f) => (
              <button
                key={f}
                onClick={() => settings.setFit(f)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-primary-600/20",
                  settings.fit === f && "text-primary-300"
                )}
              >
                {f === "width" ? "ملء العرض" : f === "height" ? "ملء الطول" : "الحجم الأصلي"}
              </button>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="reader-settings-menu-trigger" variant="ghost" size="icon"><Settings2 className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 space-y-3 p-4">
            <SliderRow label="التكبير" value={settings.zoom} onChange={settings.setZoom} min={50} max={200} />
            <SliderRow label="السطوع" value={settings.brightness} onChange={settings.setBrightness} min={40} max={150} />
            <SliderRow label="التباين" value={settings.contrast} onChange={settings.setContrast} min={40} max={150} />
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-lunex-gray">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary-500"
      />
    </div>
  );
}
