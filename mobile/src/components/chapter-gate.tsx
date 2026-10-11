import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { BookOpenCheck, Coins, Lock } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { apiJson, ApiError } from "../lib/api";
import type { Wallet } from "../lib/wallet";
import { colors, lunexGradient, panel, radius } from "../theme";
import { LinearGradient } from "expo-linear-gradient";
import { Badge, Button, Row, Txt } from "./ui";

/** The site's reader/chapter-gate.tsx messages. */
const UNLOCK_ERRORS: Record<string, string> = {
  insufficient_credits: "ما عندك رصيد قراءة بعد. اقرأ المزيد من الفصول لتحصل على فتح مجاني.",
  insufficient_coins: "رصيدك من العملات لا يكفي لفتح هذا الفصل.",
  error: "تعذر فتح الفصل، حاول مرة أخرى.",
};

function LockMark() {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 96, height: 96 }}>
      <View style={styles.glow} />
      <Lock size={56} color={colors.primary300} />
    </View>
  );
}

/**
 * Stands in front of a locked chapter (the site's reader/chapter-gate.tsx): a guest is asked to sign in; a member can open it with
 * a reading credit or with coins. The server decides; this only explains and asks.
 */
export function ChapterGate({
  chapterId,
  chapterNumber,
  seriesTitle,
  seriesSlug,
  wallet,
  signedIn,
}: {
  chapterId: string;
  chapterNumber: number;
  seriesTitle: string;
  seriesSlug: string;
  wallet?: Wallet;
  signedIn: boolean;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"credit" | "coins" | null>(null);
  const [error, setError] = useState("");
  const back = () => router.dismissTo({ pathname: "/series/[slug]", params: { slug: seriesSlug } });

  if (!signedIn || !wallet) {
    return (
      <ScrollView contentContainerStyle={styles.center}>
        <LockMark />
        <Txt display size={24} weight="900" align="center">
          هذا الفصل مقفل
        </Txt>
        <Txt size={14} color={colors.muted} align="center" style={{ lineHeight: 22 }}>
          الفصل {chapterNumber} من {seriesTitle} من أحدث الفصول. سجّل دخولك لتفتحه بالقراءة أو بالعملات، أو اقرأ الفصول المفتوحة بلا حساب.
        </Txt>
        <View style={{ alignSelf: "stretch", gap: 8 }}>
          <Button label="تسجيل الدخول" onPress={() => router.push("/login")} />
          <Button label="العودة إلى صفحة العمل" variant="ghost" onPress={back} />
        </View>
      </ScrollView>
    );
  }

  const perCredit = wallet.chaptersPerCredit || 1;
  const toNext = Math.max(0, perCredit - wallet.creditProgress);

  async function open(method: "credit" | "coins") {
    setBusy(method);
    setError("");
    try {
      await apiJson(`/api/chapters/${encodeURIComponent(chapterId)}/unlock`, { method: "POST", body: JSON.stringify({ method }) });
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch (err) {
      setError(UNLOCK_ERRORS[err instanceof ApiError ? (err.code ?? "error") : "error"] ?? UNLOCK_ERRORS.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.center}>
      <LockMark />
      <View style={{ gap: 8 }}>
        <Txt display size={24} weight="900" align="center">
          هذا الفصل مقفل
        </Txt>
        <Txt size={14} color={colors.muted} align="center">
          الفصل {chapterNumber} من {seriesTitle} من أحدث الفصول. افتحه بإحدى الطريقتين:
        </Txt>
      </View>

      <View style={[panel, { alignSelf: "stretch", padding: 20, gap: 16 }]}>
        <View style={{ gap: 8 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Row gap={8}>
              <BookOpenCheck size={16} color="#34d399" />
              <Txt size={14} weight="700">
                بالقراءة
              </Txt>
            </Row>
            <Badge label={`${wallet.unlockCredits} رصيد`} variant={wallet.unlockCredits > 0 ? "default" : "secondary"} />
          </Row>
          <View style={styles.track}>
            <LinearGradient {...lunexGradient} style={{ height: 8, width: `${Math.min(100, (wallet.creditProgress / perCredit) * 100)}%`, alignSelf: "flex-end" }} />
          </View>
          <Txt size={12} color={colors.muted}>
            كل {perCredit} فصول تُنهيها تمنحك فتح فصل مقفل مجانًا. المتبقي للرصيد القادم: {toNext} فصلًا.
          </Txt>
          <Button
            label="استخدم رصيد القراءة لفتح الفصل"
            icon={<BookOpenCheck size={16} color={colors.text} />}
            disabled={wallet.unlockCredits < 1 || busy !== null}
            loading={busy === "credit"}
            onPress={() => void open("credit")}
          />
        </View>

        <View style={{ gap: 8, borderTopWidth: 2, borderTopColor: colors.white10, paddingTop: 16 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Row gap={8}>
              <Coins size={16} color="#facc15" />
              <Txt size={14} weight="700">
                بالعملات
              </Txt>
            </Row>
            <Badge label={`${wallet.coins} عملة`} variant="secondary" />
          </Row>
          <Txt size={12} color={colors.muted}>
            سعر فتح الفصل {wallet.coinPrice} عملة.
          </Txt>
          <Button
            label={`افتح الفصل بـ ${wallet.coinPrice} عملة`}
            variant="secondary"
            icon={<Coins size={16} color={colors.text} />}
            disabled={wallet.coins < wallet.coinPrice || busy !== null}
            loading={busy === "coins"}
            onPress={() => void open("coins")}
          />
          {wallet.coins < wallet.coinPrice && <Button label="كيف أحصل على عملات؟" variant="ghost" onPress={() => router.navigate("/store")} />}
        </View>

        {error ? (
          <Txt size={14} color="#f87171">
            {error}
          </Txt>
        ) : null}
      </View>

      <Button label="العودة إلى صفحة العمل" variant="ghost" onPress={back} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24, paddingVertical: 40 },
  glow: { position: "absolute", width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(109,40,217,0.35)" },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.white10, overflow: "hidden" },
});
