"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Team } from "@/lib/types";
import { teamApi } from "@/lib/team-api";
import { useToast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Moves the given works (and their chapters) to the team the owner picks — or off every team. Closed while `seriesIds` is null. */
export function TransferSeriesDialog({
  seriesIds,
  titles,
  teams,
  onClose,
  onDone,
}: {
  seriesIds: string[] | null;
  /** What to call the works in the heading: their titles, when there are only a few. */
  titles: string[];
  teams: Team[];
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Dialog open={seriesIds !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {seriesIds && <Form seriesIds={seriesIds} titles={titles} teams={teams} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ seriesIds, titles, teams, onClose, onDone }: { seriesIds: string[]; titles: string[]; teams: Team[]; onClose: () => void; onDone: () => void }) {
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function move() {
    if (!dest || busy) return;
    setBusy(true);
    setError("");
    const result = await teamApi.transferSeries(seriesIds, dest === "none" ? "" : dest);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    const target = dest === "none" ? "بدون فريق" : (teams.find((t) => t.id === dest)?.name ?? "الفريق");
    useToast.getState().push({
      title: "تم النقل",
      description: `نُقل ${result.body.series} عمل${result.body.chapters ? ` و${result.body.chapters} فصل` : ""} إلى ${target}.`,
    });
    onDone();
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>نقل {seriesIds.length === 1 ? "العمل" : `${seriesIds.length} أعمال`} إلى فريق</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 pt-2">
        {titles.length > 0 && titles.length <= 4 && (
          <ul className="list-disc space-y-0.5 ps-5 text-sm text-lunex-gray">
            {titles.map((t) => <li key={t}>{t}</li>)}
          </ul>
        )}
        <Select value={dest} onValueChange={setDest}>
          <SelectTrigger aria-label="الفريق الجديد"><SelectValue placeholder="اختر الفريق..." /></SelectTrigger>
          <SelectContent className="max-h-72">
            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            <SelectItem value="none">بدون فريق</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-lunex-gray">تنتقل فصول العمل معه إلى الفريق الجديد، ويصير هذا الفريق هو الناشر المعروض للقرّاء.</p>
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        <Button onClick={move} disabled={!dest || busy} className="w-full">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} نقل
        </Button>
      </div>
    </>
  );
}
