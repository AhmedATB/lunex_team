import Image from "next/image";
import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-[#09090B] px-4 text-center">
      <Image
        src="/phase-archive.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-contain opacity-90"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_46%_30%_at_50%_50%,rgba(9,9,11,0.82)_0%,rgba(9,9,11,0.35)_75%,transparent_100%)]" />

      <div className="relative z-10 flex flex-col items-center gap-4">
        <span className="bg-lunex-gradient bg-clip-text font-display text-7xl font-black text-transparent">
          404
        </span>
        <h1 className="font-display text-2xl font-bold text-white">الصفحة غير موجودة</h1>
        <p className="max-w-sm text-sm text-lunex-gray">
          الصفحة التي تبحث عنها غير متوفرة، ربما تم نقلها أو حذفها.
        </p>
        <Button asChild>
          <Link href="/"><Compass className="h-4 w-4" /> العودة للرئيسية</Link>
        </Button>
      </div>
    </div>
  );
}
