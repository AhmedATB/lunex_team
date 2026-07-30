"use client";

import { useState } from "react";
import { Settings2, Trash2 } from "lucide-react";
import type { Chapter } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type LockChoice = "auto" | "locked" | "open";

export function ChapterAdminMenu({
  chapter,
  isPublished,
  manualLock,
  onSave,
  onSetLock,
  onDelete,
}: {
  chapter: Chapter;
  isPublished: boolean;
  manualLock: boolean | undefined;
  onSave: (patch: { title: string; isPublished: boolean }) => void;
  onSetLock: (locked: boolean | undefined) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(chapter.title);
  const [published, setPublished] = useState(isPublished);
  const [lockChoice, setLockChoice] = useState<LockChoice>(
    manualLock === true ? "locked" : manualLock === false ? "open" : "auto"
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function submit() {
    if (!title.trim()) return;
    onSave({ title: title.trim(), isPublished: published });
    onSetLock(lockChoice === "auto" ? undefined : lockChoice === "locked");
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setConfirmingDelete(false);
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="إعدادات الفصل" className="relative shrink-0">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>إعدادات الفصل {chapter.number}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>اسم الفصل</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <Label>منشور</Label>
            <Switch checked={published} onCheckedChange={setPublished} />
          </div>

          <div className="space-y-1.5">
            <Label>حالة القفل</Label>
            <Select value={lockChoice} onValueChange={(v) => setLockChoice(v as LockChoice)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">تلقائي (حسب إعدادات المنصة)</SelectItem>
                <SelectItem value="locked">مقفل دائماً</SelectItem>
                <SelectItem value="open">مفتوح دائماً</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={submit} className="w-full">حفظ التغييرات</Button>

          <div className="border-t-2 border-white/10 pt-3">
            {confirmingDelete ? (
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" /> تأكيد الحذف
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmingDelete(false)}>
                  تراجع
                </Button>
              </div>
            ) : (
              <Button variant="destructive" className="w-full" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="h-4 w-4" /> حذف الفصل
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
