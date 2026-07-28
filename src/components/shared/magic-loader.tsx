export function MagicLoader({ size = 64, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10" role="status" aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full border-2 border-primary-500/25"
          style={{ animation: "spin-slow 3s linear infinite" }}
        />
        <div
          className="absolute inset-2 rounded-full border-t-2 border-primary-300"
          style={{ animation: "spin-slow 1.1s linear infinite" }}
        />
        <div className="absolute inset-0" style={{ animation: "spin-slow 4s linear infinite" }}>
          <div
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary-300 to-pink-300"
            style={{ boxShadow: "0 0 12px 3px rgba(192,132,252,0.8)", animation: "moon-orbit 2.4s linear infinite" }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2.5 w-2.5 rounded-full bg-white" style={{ boxShadow: "0 0 14px 4px rgba(255,255,255,0.7)" }} />
        </div>
      </div>
      {label && <p className="text-sm font-medium text-lunex-gray">{label}</p>}
    </div>
  );
}
