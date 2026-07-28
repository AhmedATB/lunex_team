"use client";

import { useEffect, useMemo, useState } from "react";
import { UploadCloud, FileArchive, Trash2, Search } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

export default function AdminChaptersPage() {
  useEffect(() => {
    document.title = "إدارة الفصول | LUNEX TEAM";
  }, []);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const db = useMemo(() => getMockDatabase(), []);
  const seriesMap = useMemo(() => new Map(db.series.map((s) => [s.id, s])), [db.series]);

  const chapters = useMemo(
    () =>
      [...db.chapters]
        .sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt))
        .filter((c) => !query || seriesMap.get(c.seriesId)?.titleAr.includes(query))
        .slice(0, 40),
    [db.chapters, query, seriesMap]
  );

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">إدارة الفصول</h1>

      <Card>
        <CardHeader><CardTitle>رفع فصل جديد</CardTitle></CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); }}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-primary-400 bg-primary-500/10" : "border-white/15 bg-white/[0.02]"
            }`}
          >
            <UploadCloud className="h-10 w-10 text-primary-300" />
            <p className="text-sm text-white">اسحب وأفلت ملفات الصور أو ZIP هنا</p>
            <p className="text-xs text-lunex-gray">يدعم JPG, PNG, WebP وملفات ZIP (حد أقصى 200 ميجابايت)</p>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="secondary"><FileArchive className="h-4 w-4" /> اختر ملف ZIP</Button>
              <Button size="sm">اختر صوراً</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالسلسلة..." className="ps-9" />
        </div>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4" /> حذف المحدد ({selected.size})
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-lunex-gray">
                <th className="w-10 p-3"></th>
                <th className="p-3 text-start font-medium">السلسلة</th>
                <th className="p-3 text-start font-medium">الفصل</th>
                <th className="p-3 text-start font-medium">الصفحات</th>
                <th className="p-3 text-start font-medium">الحالة</th>
                <th className="p-3 text-start font-medium">تاريخ النشر</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c) => (
                <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="p-3">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  </td>
                  <td className="max-w-[200px] truncate p-3 font-medium text-white">
                    {seriesMap.get(c.seriesId)?.titleAr}
                  </td>
                  <td className="p-3 text-lunex-gray">{c.title}</td>
                  <td className="p-3 text-lunex-gray">{c.pages}</td>
                  <td className="p-3"><Badge variant="success">منشور</Badge></td>
                  <td className="p-3 text-lunex-gray">{timeAgo(c.releasedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
