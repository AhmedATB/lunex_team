import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowRight, Crown, Plus, Sparkle, Trophy, Users } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GUTTER } from "../../components/layout";
import { TeamLogo } from "../../components/team-logo";
import { Badge, Button, Loading, Row, Txt } from "../../components/ui";
import { useBootstrap } from "../../lib/catalog";
import { SITE_URL } from "../../lib/config";
import { colors, panel } from "../../theme";

/** The site's /teams ("فرق الترجمة"). Creating a team stays on the site, where the request form and its review live. */
export default function TeamsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useBootstrap();
  const teams = useMemo(
    () => (data?.teams ?? []).map((team) => ({ team, seriesCount: (data?.series ?? []).filter((s) => s.teamId === team.id).length })),
    [data],
  );
  if (isLoading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: GUTTER, paddingTop: insets.top + 56, gap: 24, paddingBottom: 40 }}>
        <View style={{ gap: 8 }}>
          <Txt display size={24} weight="700">
            فرق الترجمة
          </Txt>
          <Txt size={14} color={colors.muted} style={{ lineHeight: 22 }}>
            كل فريق يعمل باستقلالية على مشاريعه الخاصة ضمن منظومة LUNEX TEAM.
          </Txt>
        </View>
        <Button size="lg" label="إنشاء فريق جديد" icon={<Plus size={16} color={colors.text} />} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/teams/create`)} />
        {teams.map(({ team, seriesCount }) => (
          <Pressable
            key={team.id}
            onPress={() => router.push({ pathname: "/teams/[slug]", params: { slug: team.slug } })}
            style={({ pressed }) => [panel, { padding: 20, gap: 12 }, pressed && { borderColor: "rgba(168,85,247,0.4)", transform: [{ scale: 0.98 }] }]}
          >
            {(team.rank ?? 99) <= 3 && (
              <View style={{ position: "absolute", top: 12, left: 12 }}>
                <Sparkle size={16} color={colors.amber300} fill={colors.amber300} />
              </View>
            )}
            <Row style={{ justifyContent: "space-between" }}>
              <TeamLogo team={team} />
              <Badge
                label={team.recruiting ? "يستقبل طلبات" : "مكتمل العدد"}
                variant="secondary"
                style={team.recruiting ? { backgroundColor: "#34d399" } : undefined}
              />
            </Row>
            <Txt display size={18} weight="700">
              {team.name}
            </Txt>
            {team.description ? (
              <Txt size={13} color={colors.muted} numberOfLines={2}>
                {team.description}
              </Txt>
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.white10 }} />
            <Row gap={16}>
              <Row gap={4}>
                <Users size={14} color={colors.muted} />
                <Txt size={12} color={colors.muted}>
                  {team.memberIds?.length ?? 0} عضو
                </Txt>
              </Row>
              <Row gap={4}>
                <Trophy size={14} color={colors.muted} />
                <Txt size={12} color={colors.muted}>
                  #{team.rank ?? "—"}
                </Txt>
              </Row>
              <Row gap={4}>
                <Crown size={14} color={colors.muted} />
                <Txt size={12} color={colors.muted}>
                  {seriesCount} مشروع
                </Txt>
              </Row>
            </Row>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable onPress={() => router.back()} style={{ position: "absolute", top: insets.top + 8, right: 16, padding: 8 }} hitSlop={8}>
        <ArrowRight size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}
