import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { absolute } from "../lib/config";
import type { Team } from "../lib/types";
import { Txt } from "./ui";

/** A team's logo, or its first letter on its own colour fading to lilac (the site's team tiles). */
export function TeamLogo({ team, size = 48 }: { team: Pick<Team, "name" | "color" | "logoUrl">; size?: number }) {
  const style = { width: size, height: size, borderRadius: size * 0.33, overflow: "hidden" as const };
  if (team.logoUrl) return <Image source={absolute(team.logoUrl)} style={style} contentFit="cover" />;
  return (
    <LinearGradient colors={[team.color || "#6d28d9", "#C084FC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[style, { alignItems: "center", justifyContent: "center" }]}>
      <Txt display size={size * 0.38} weight="900" align="center">
        {team.name.slice(0, 1)}
      </Txt>
    </LinearGradient>
  );
}
