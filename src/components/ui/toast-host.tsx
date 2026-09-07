"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Trophy } from "lucide-react";
import { useToast } from "@/store/toast";

const AUTO_DISMISS_MS = 5000;

export function ToastHost() {
  const items = useToast((s) => s.items);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:end-4 sm:items-end">
      <AnimatePresence>
        {items.map((t) => (
          <ToastCard key={t.id} id={t.id} title={t.title} description={t.description} onDismiss={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({
  id,
  title,
  description,
  onDismiss,
}: {
  id: string;
  title: string;
  description?: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-primary-400/30 bg-[#150c26] p-4 shadow-2xl shadow-primary-900/50"
    >
      <div className="art-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lunex-gradient">
        <Trophy className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-white">{title}</p>
        {description && <p className="mt-0.5 text-xs text-lunex-gray">{description}</p>}
      </div>
      <button onClick={onDismiss} className="shrink-0 text-lunex-gray hover:text-white" aria-label="إغلاق">
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
