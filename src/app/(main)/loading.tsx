import { MagicLoader } from "@/components/shared/magic-loader";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <MagicLoader size={72} label="تُحاك السحر..." />
    </div>
  );
}
