import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Star } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { apiFetch, apiJson } from "../lib/api";
import { useSession } from "../lib/session";
import { colors, panel } from "../theme";
import { Row, Txt } from "./ui";

/** The site's rating box (series/rating-widget.tsx): the average and count, and five stars for a member to rate with. */
export function RatingWidget({ seriesId, rating, ratingCount }: { seriesId: string; rating: number; ratingCount: number }) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["rating", seriesId, status],
    queryFn: () => apiJson<{ average: number; count: number; mine: number | null }>(`/api/catalog/series/${encodeURIComponent(seriesId)}/rating`),
    enabled: status === "signedIn",
  });
  const [pending, setPending] = useState<number | null>(null);
  const average = data?.average ?? rating;
  const count = data?.count ?? ratingCount;
  const mine = pending ?? data?.mine ?? null;

  async function rate(value: number) {
    if (status !== "signedIn") return router.push("/login");
    setPending(value);
    const res = await apiFetch(`/api/catalog/series/${encodeURIComponent(seriesId)}/rating`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }).catch(() => null);
    setPending(null);
    if (res?.ok) void queryClient.invalidateQueries({ queryKey: ["rating", seriesId] });
  }

  return (
    <View style={[panel, { padding: 16, gap: 10 }]}>
      <Row gap={8}>
        <Star size={24} color={colors.amber400} fill={colors.amber400} />
        <Txt display size={22} weight="800">
          {count > 0 ? average.toFixed(1) : "—"}
        </Txt>
        <Txt size={13} color={colors.muted}>
          ({count} تقييم)
        </Txt>
      </Row>
      {status === "signedIn" ? (
        <View style={{ gap: 6 }}>
          <Txt size={13} color={colors.muted}>
            {mine ? "تقييمك:" : "قيّم هذا العمل:"}
          </Txt>
          <Row gap={6}>
            {[1, 2, 3, 4, 5].map((v) => (
              <Pressable key={v} onPress={() => rate(v)} hitSlop={4}>
                <Star size={28} color={colors.amber400} fill={mine && v <= mine ? colors.amber400 : "transparent"} />
              </Pressable>
            ))}
          </Row>
        </View>
      ) : (
        <Pressable onPress={() => router.push("/login")}>
          <Txt size={13} color={colors.muted}>
            سجّل الدخول لتقييم هذا العمل.
          </Txt>
        </Pressable>
      )}
    </View>
  );
}
