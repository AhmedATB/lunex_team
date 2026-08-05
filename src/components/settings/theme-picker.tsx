"use client";

import { Check, Palette, Sparkles } from "lucide-react";
import { ACCENT_PRESETS } from "@/lib/accent-presets";
import { STYLE_PRESETS } from "@/lib/theme-presets";
import { useTheme } from "@/store/theme";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const style = useTheme((s) => s.style);
  const accent = useTheme((s) => s.accent);
  const setStyle = useTheme((s) => s.setStyle);
  const setAccent = useTheme((s) => s.setAccent);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-xs font-bold text-lunex-gray">
          <Sparkles className="h-3.5 w-3.5" /> النمط
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STYLE_PRESETS.map((preset) => {
            const active = style === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setStyle(preset.id)}
                className={cn(
                  "hover-pop flex flex-col items-start gap-2 rounded-xl border p-3 text-start transition-colors",
                  active ? "border-primary-400 bg-primary-500/10" : "border-white/10 hover:border-white/20"
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span
                    className="h-7 w-7 rounded-full border border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${preset.swatchBg} 50%, ${preset.swatchAccent} 100%)`,
                    }}
                  />
                  {active && <Check className="h-4 w-4 text-primary-300" />}
                </span>
                <span className="text-xs font-semibold text-white">{preset.nameAr}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-xs font-bold text-lunex-gray">
          <Palette className="h-3.5 w-3.5" /> لون التمييز
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAccent(null)}
            aria-label="اللون الافتراضي للنمط"
            title="افتراضي"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[9px] font-bold text-lunex-gray transition-transform hover:scale-110",
              accent === null ? "border-primary-400" : "border-white/15"
            )}
          >
            A
          </button>
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setAccent(preset.id)}
              aria-label={preset.nameAr}
              title={preset.nameAr}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                accent === preset.id ? "border-white" : "border-transparent"
              )}
              style={{ background: preset.swatch }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
