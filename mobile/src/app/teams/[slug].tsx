import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowRight, Crown, ExternalLink, UserPlus, Users } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../components/comments";
import { GUTTER } from "../../components/layout";
import { SeriesCard } from "../../components/series-card";
import { TeamLogo } from "../../components/team-logo";
import { Button, ErrorState, Loading, Panel, Row, SectionHeader, Txt } from "../../components/ui";
import { apiJson } from "../../lib/api";
import { useBootstrap } from "../../lib/catalog";
import { SITE_URL } from "../../lib/config";
import { useSession } from "../../lib/session";
import type { Series, Tag, Team } from "../../lib/types";
import { colors, panel } from "../../theme";

/** lib/rbac.ts TEAM_ROLE_LABELS */
const TEAM_ROLE_LABELS: Record<string, string> = {
  trainee: "متدرب",
  member: "عضو",
  translator: "مترجم",
  editor: "محرر",
  proofreader: "مدقق لغوي",
  qc: "مراقبة جودة",
  publisher: "ناشر",
  uploader: "رافع",
  recruiter: "مسؤول توظيف",
  reviewer: "مراجع",
  team_administrator: "مدير فريق",
  assistant_leader: "نائب القائد",
  team_leader: "قائد الفريق",
};

interface TeamMember {
  id: string;
  username: string;
  displayName: string;
  avatarVersion: string | null;
  teamRole?: string;
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <Panel style={{ flex: 1, alignItems: "center", paddingVertical: 16, gap: 4 }}>
      <Row gap={6}>
        <Users size={16} color={colors.primary300} />
        <Txt display size={18} weight="800">
          {value}
        </Txt>
      </Row>
      <Txt size={12} color={colors.muted}>
        {label}
      </Txt>
    </Panel>
  );
}

/** The site's /teams/[slug]: the team card, its numbers, members and projects. Applying to join happens on the site. */
export default function TeamScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { status } = useSession();
  const { data: boot } = useBootstrap();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["team", slug],
    queryFn: () => apiJson<{ team: Team; members: TeamMember[]; series: Series[] }>(`/api/catalog/teams/${encodeURIComponent(slug)}`),
  });
  const tags = useMemo(() => new Map<string, Tag>((boot?.tags ?? []).map((t) => [t.id, t])), [boot]);

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;
  const { team, members, series } = data;
  const cardWidth = (width - GUTTER * 2 - 16) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: GUTTER, paddingTop: insets.top + 56, gap: 32, paddingBottom: 40 }}>
        <View style={[panel, { padding: 24, alignItems: "center", gap: 14 }]}>
          <TeamLogo team={team} size={96} />
          <Row gap={8} style={{ flexWrap: "wrap", justifyContent: "center" }}>
            <Txt display size={24} weight="800" align="center">
              {team.name}
            </Txt>
            {team.recruiting && (
              <View style={{ backgroundColor: "#34d399", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                <Txt size={12} weight="700" color="#052e16">
                  يستقبل طلبات انضمام
                </Txt>
              </View>
            )}
          </Row>
          {team.description ? (
            <Txt size={14} color={colors.muted} align="center" style={{ lineHeight: 23 }}>
              {team.description}
            </Txt>
          ) : null}
          <Row gap={10} style={{ alignSelf: "stretch" }}>
            {team.recruiting && (
              <Button
                label={status === "signedIn" ? "قدّم على الفريق" : "سجّل الدخول للتقديم"}
                icon={<UserPlus size={16} color={colors.text} />}
                onPress={() => (status === "signedIn" ? WebBrowser.openBrowserAsync(`${SITE_URL}/teams/${team.slug}`) : router.push("/login"))}
                style={{ flex: 1 }}
              />
            )}
            {team.discordUrl ? (
              <Button
                label="Discord"
                variant="secondary"
                icon={<ExternalLink size={16} color={colors.text} />}
                onPress={() => WebBrowser.openBrowserAsync(team.discordUrl!)}
                style={{ flex: team.recruiting ? 0 : 1, paddingHorizontal: 8 }}
              />
            ) : null}
          </Row>
        </View>

        <Row gap={12}>
          <StatBox value={String(series.length)} label="المشاريع" />
          <StatBox value={String(members.length)} label="الأعضاء" />
          <StatBox value={`#${team.rank ?? "—"}`} label="الترتيب" />
        </Row>

        <View>
          <SectionHeader title="الأعضاء" style={{ paddingHorizontal: 0 }} />
          <View style={{ gap: 10 }}>
            {members.map((m) => (
              <View key={m.id} style={[panel, { padding: 14 }]}>
                <Row gap={12}>
                  <Avatar user={m} size={44} />
                  <View style={{ flex: 1 }}>
                    <Txt size={14} weight="700">
                      {m.displayName || m.username}
                    </Txt>
                    <Txt size={12} color={colors.primary300}>
                      {TEAM_ROLE_LABELS[m.teamRole ?? "member"] ?? m.teamRole}
                    </Txt>
                  </View>
                  {m.teamRole === "team_leader" && <Crown size={18} color={colors.amber400} fill={colors.amber400} />}
                </Row>
              </View>
            ))}
          </View>
        </View>

        {series.length > 0 && (
          <View>
            <SectionHeader title="مشاريع الفريق" style={{ paddingHorizontal: 0 }} />
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 16 }}>
              {series.map((s) => (
                <SeriesCard key={s.id} series={s} tags={tags} width={cardWidth} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      <Pressable onPress={() => router.back()} style={{ position: "absolute", top: insets.top + 8, right: 16, padding: 8 }} hitSlop={8}>
        <ArrowRight size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}
