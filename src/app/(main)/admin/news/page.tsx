"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useSession } from "@/store/session";
import { useToast } from "@/store/toast";
import { ImagePicker } from "@/components/admin/image-picker";
import { NEWS_CATEGORY_LABELS, newsApi, type EditorNews, type NewsCategory } from "@/lib/news-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/utils";

const NEWS_EDITORS = new Set(["owner", "super_administrator", "news_manager"]);

const say = (title: string, description?: string) => useToast.getState().push({ title, description });

/** Publishing news: write a post, choose its picture from the device, publish it now or keep it as a draft. A published post also reaches every member's notifications. */
export default function AdminNewsPage() {
  useEffect(() => {
    document.title = "الأخبار | LUNEX TEAM";
  }, []);

  const router = useRouter();
  const role = useSession((s) => s.user?.role);
  const allowed = role !== undefined && NEWS_EDITORS.has(role);

  const [items, setItems] = useState<EditorNews[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditorNews | "new" | null>(null);
  const [deleting, setDeleting] = useState<EditorNews | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await newsApi.list();
    if (result.ok) {
      setItems(result.body.items);
      setError("");
    } else {
      setError(result.message);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  async function togglePublished(item: EditorNews) {
    const result = await newsApi.update(item.id, { isPublished: !item.isPublished });
    if (!result.ok) return say("تعذر التغيير", result.message);
    say(item.isPublished ? "أُخفي الخبر" : "نُشر الخبر", item.title);
    await load();
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await newsApi.remove(deleting.id);
    setBusy(false);
    if (!result.ok) return say("تعذر الحذف", result.message);
    say("حُذف الخبر", deleting.title);
    setDeleting(null);
    await load();
    router.refresh();
  }

  if (!allowed) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-10 text-center">
        <ShieldAlert className="h-10 w-10 text-red-400" />
        <p className="text-white">نشر الأخبار لمدير الأخبار والمالك.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-white">الأخبار{items && ` (${items.length})`}</h1>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> خبر جديد
        </Button>
      </div>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      {items === null && !error ? (
        <div className="flex justify-center py-12 text-lunex-gray"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items?.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-lunex-gray">لا توجد أخبار بعد. اكتب أول خبر.</div>
      ) : (
        <ul className="space-y-3">
          {items?.map((item) => (
            <li key={item.id}>
              <Card>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg">
                    <Image src={item.cover} alt="" fill sizes="96px" className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-lunex-gray">
                      <Badge variant="secondary">{NEWS_CATEGORY_LABELS[item.category]}</Badge>
                      <Badge variant={item.isPublished ? "success" : "warning"}>{item.isPublished ? "منشور" : "مسودة"}</Badge>
                      <span>{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => togglePublished(item)}>
                      {item.isPublished ? "إخفاء" : "نشر"}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(item)} aria-label={`تعديل ${item.title}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => setDeleting(item)} aria-label={`حذف ${item.title}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <NewsForm
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
          router.refresh();
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف «{deleting?.title}»؟</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-lunex-gray">يُحذف الخبر نهائيًا من الموقع.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} حذف
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(null)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewsForm({ item, onClose, onSaved }: { item: EditorNews | "new" | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {item !== null && <FormBody key={item === "new" ? "new" : item.id} item={item === "new" ? null : item} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function FormBody({ item, onSaved }: { item: EditorNews | null; onSaved: () => void | Promise<void> }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [excerpt, setExcerpt] = useState(item?.excerpt ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [category, setCategory] = useState<NewsCategory>(item?.category ?? "news");
  const [published, setPublished] = useState(item?.isPublished ?? true);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || busy) return;
    setBusy(true);
    setError("");
    const input = { title: title.trim(), excerpt: excerpt.trim(), content: content.trim(), category, isPublished: published };
    const saved = item ? await newsApi.update(item.id, input) : await newsApi.create(input);
    if (!saved.ok) {
      setBusy(false);
      setError(saved.message);
      return;
    }
    let coverFailed = "";
    if (cover) {
      const uploaded = await newsApi.uploadCover(saved.body.id, cover);
      if (!uploaded.ok) coverFailed = uploaded.message;
    }
    setBusy(false);
    say(
      coverFailed ? "حُفظ الخبر، لكن تعذر رفع الصورة" : item ? "حُفظ الخبر" : published ? "نُشر الخبر" : "حُفظت المسودة",
      coverFailed || title.trim()
    );
    await onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{item ? "تعديل الخبر" : "خبر جديد"}</DialogTitle>
      </DialogHeader>

      <ImagePicker label="صورة الخبر" hint="من جهازك. تُقص إلى 1200×630." current={item?.cover} file={cover} onChange={setCover} aspect="aspect-[1200/630]" className="[&_button:first-of-type]:w-44" />

      <div className="space-y-1.5">
        <Label htmlFor="n-title">العنوان *</Label>
        <Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="n-excerpt">ملخص قصير</Label>
        <Textarea id="n-excerpt" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={500} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="n-content">نص الخبر</Label>
        <Textarea id="n-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} maxLength={20000} />
      </div>
      <div className="space-y-1.5">
        <Label>النوع</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as NewsCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(NEWS_CATEGORY_LABELS) as NewsCategory[]).map((c) => <SelectItem key={c} value={c}>{NEWS_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
        <span>
          <span className="block text-sm font-semibold text-white">نشر الآن</span>
          <span className="flex items-center gap-1 text-xs text-lunex-gray">
            <Bell className="h-3 w-3" /> عند النشر يصل إشعار لكل الأعضاء. المسودة لا يراها أحد.
          </span>
        </span>
        <Switch checked={published} onCheckedChange={setPublished} />
      </label>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || title.trim().length < 3}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {item ? "حفظ" : published ? "نشر الخبر" : "حفظ كمسودة"}
      </Button>
    </form>
  );
}
