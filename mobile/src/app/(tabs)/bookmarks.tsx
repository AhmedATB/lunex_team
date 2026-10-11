import { Bookmark } from "lucide-react-native";
import { useMemo } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { AppHeader } from "../../components/app-header";
import { GUTTER } from "../../components/layout";
import { SeriesCard } from "../../components/series-card";
import { SignInRequired } from "../../components/signin-required";
import { Loading, Panel, Row, Txt } from "../../components/ui";
import { useBootstrap } from "../../lib/catalog";
import { useLibrary } from "../../lib/library";
import { useSession } from "../../lib/session";
import type { Tag } from "../../lib/types";
import { colors } from "../../theme";

/** The site's /bookmarks ("مفضلتي"). */
export default function BookmarksScreen() {
  const { width } = useWindowDimensions();
  const { status } = useSession();
  const { data } = useBootstrap();
  const { bookmarks } = useLibrary();
  const tags = useMemo(() => new Map<string, Tag>((data?.tags ?? []).map((t) => [t.id, t])), [data]);
  const saved = useMemo(() => (data?.series ?? []).filter((s) => bookmarks.includes(s.id)), [data, bookmarks]);
  const cardWidth = (width - GUTTER * 2 - 16) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      {status === "loading" ? (
        <Loading />
      ) : status !== "signedIn" ? (
        <SignInRequired text="سجّل الدخول لتحفظ أعمالك المفضلة وتجدها على كل أجهزتك." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: GUTTER, paddingTop: 24, gap: 24, paddingBottom: 40 }}>
          <Row gap={8}>
            <Bookmark size={24} color={colors.primary300} />
            <Txt display size={24} weight="700">
              مفضلتي
            </Txt>
          </Row>
          {saved.length === 0 ? (
            <Panel style={{ padding: 48, alignItems: "center", gap: 12 }}>
              <Bookmark size={40} color={colors.muted} />
              <Txt color={colors.muted} align="center">
                لم تضف أي سلسلة إلى المفضلة بعد.
              </Txt>
            </Panel>
          ) : (
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 16 }}>
              {saved.map((s) => (
                <SeriesCard key={s.id} series={s} tags={tags} width={cardWidth} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
