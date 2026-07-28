import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#09090B] px-4 text-center">
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
  );
}
