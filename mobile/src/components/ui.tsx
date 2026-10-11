import { LinearGradient } from "expo-linear-gradient";
import { Star } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, lunexGradient, panel, radius } from "../theme";

type Weight = "400" | "500" | "600" | "700" | "800" | "900";

/**
 * The site's two families (layout.tsx): Tajawal for body text (`font-sans`) and Baloo Bhaijaan 2 for titles (`font-display`).
 * Android picks a custom font's weight by its file, not by fontWeight, so each weight names its own file. Tajawal has no 600; the
 * browser rounds a 600 up to 700, and so does this.
 */
const SANS: Record<Weight, string> = {
  "400": "Tajawal_400Regular",
  "500": "Tajawal_500Medium",
  "600": "Tajawal_700Bold",
  "700": "Tajawal_700Bold",
  "800": "Tajawal_800ExtraBold",
  "900": "Tajawal_900Black",
};
const DISPLAY: Record<Weight, string> = {
  "400": "BalooBhaijaan2_500Medium",
  "500": "BalooBhaijaan2_500Medium",
  "600": "BalooBhaijaan2_600SemiBold",
  "700": "BalooBhaijaan2_700Bold",
  "800": "BalooBhaijaan2_800ExtraBold",
  "900": "BalooBhaijaan2_800ExtraBold",
};

/**
 * Text, right-aligned. The app is laid out right to left by hand rather than through I18nManager: Expo Go resets the RTL setting
 * whenever it opens a project, so a forced-RTL app would look mirrored there and right in the store build. `row-reverse` rows and
 * right-aligned text look the same in both.
 */
export function Txt({
  style,
  weight = "400",
  size = 14,
  color = colors.text,
  display,
  align = "right",
  ...rest
}: TextProps & { weight?: Weight; size?: number; color?: string; display?: boolean; align?: TextStyle["textAlign"] }) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: (display ? DISPLAY : SANS)[weight], fontSize: size, color, textAlign: align, writingDirection: "rtl" },
        display && { lineHeight: size * 1.45 },
        style,
      ]}
    />
  );
}

/** A right-to-left row. */
export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row-reverse", alignItems: "center", gap }, style]}>{children}</View>;
}

/** `.panel` */
export function Panel({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[panel, style]}>{children}</View>;
}

type ButtonVariant = "default" | "secondary" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "lg";

const BUTTON_HEIGHT: Record<ButtonSize, number> = { default: 40, sm: 36, lg: 48 };

/** The site's Button (components/ui/button.tsx): gradient by default, glassy secondary, purple outline, bare ghost. */
export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "default",
  size = "default",
  icon,
  style,
}: {
  label?: string;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const height = BUTTON_HEIGHT[size];
  const content = loading ? (
    <ActivityIndicator color={colors.text} />
  ) : (
    <Row gap={8} style={{ justifyContent: "center" }}>
      {icon}
      {label ? (
        <Txt weight="700" size={size === "lg" ? 16 : size === "sm" ? 12 : 14} color={variant === "outline" ? colors.primary300 : colors.text}>
          {label}
        </Txt>
      ) : null}
    </Row>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        { height, borderRadius: size === "sm" ? radius.sm : radius.lg, overflow: "hidden" },
        variant === "default" && styles.buttonShadow,
        variant === "secondary" && styles.secondary,
        variant === "outline" && styles.outline,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.96 }] },
        style,
      ]}
    >
      {variant === "default" ? (
        <LinearGradient {...lunexGradient} style={[styles.buttonInner, { paddingHorizontal: size === "lg" ? 32 : 16 }]}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.buttonInner, { paddingHorizontal: size === "lg" ? 32 : 16 }]}>{content}</View>
      )}
    </Pressable>
  );
}

/** A small rounded label (components/ui/badge.tsx). */
export function Badge({ label, variant = "default", style }: { label: string; variant?: "default" | "secondary" | "outline"; style?: StyleProp<ViewStyle> }) {
  const inner = (
    <Txt size={12} weight="700" color={variant === "outline" ? colors.primary300 : colors.text}>
      {label}
    </Txt>
  );
  if (variant === "default") {
    return (
      <LinearGradient {...lunexGradient} style={[styles.badge, style]}>
        {inner}
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.badge, variant === "secondary" ? { backgroundColor: "rgba(0,0,0,0.5)" } : styles.badgeOutline, style]}>{inner}</View>
  );
}

/** A rating as the site shows it on cards: one decimal, or a dash while nobody has rated yet. */
export function formatRating(rating: number, ratingCount: number): string {
  return ratingCount > 0 ? rating.toFixed(1) : "—";
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/** The black pill with an amber star the site lays over covers. */
export function RatingPill({ rating, ratingCount, style, large }: { rating: number; ratingCount: number; style?: StyleProp<ViewStyle>; large?: boolean }) {
  return (
    <Row gap={4} style={[styles.ratingPill, large && { paddingHorizontal: 10, paddingVertical: 4 }, style]}>
      <Star size={large ? 14 : 12} color={colors.amber300} fill={colors.amber300} />
      <Txt size={large ? 14 : 12} weight="700" color={colors.amber300}>
        {formatRating(rating, ratingCount)}
      </Txt>
    </Row>
  );
}

/** `.section-title` with its gradient underline, and the "عرض الكل ←" link. */
export function SectionHeader({ title, onShowAll, style }: { title: string; onShowAll?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Row style={[{ justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 16 }, style]}>
      <View>
        <Txt display size={20} weight="700">
          {title}
        </Txt>
        <LinearGradient
          colors={["#6d28d9", "#f0abfc", "transparent"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 0 }}
          style={{ height: 3, width: 48, borderRadius: 999, alignSelf: "flex-end", marginTop: 2 }}
        />
      </View>
      {onShowAll ? (
        <Pressable onPress={onShowAll} hitSlop={8}>
          <Txt size={14} weight="500" color={colors.primary300}>
            عرض الكل ←
          </Txt>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function Centered({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.centered, style]}>{children}</View>;
}

export function Loading() {
  return (
    <Centered>
      <ActivityIndicator size="large" color={colors.primary400} />
    </Centered>
  );
}

export function ErrorState({ message = "تعذر تحميل المحتوى.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Centered style={{ gap: 12 }}>
      <Txt color={colors.muted} align="center">
        {message}
      </Txt>
      {onRetry && <Button label="إعادة المحاولة" variant="secondary" onPress={onRetry} />}
    </Centered>
  );
}

const styles = StyleSheet.create({
  buttonInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  buttonShadow: {
    shadowColor: colors.primary600,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    backgroundColor: colors.primary600,
  },
  secondary: { borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.05)" },
  outline: { borderWidth: 1, borderColor: "rgba(168,85,247,0.6)" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2, alignSelf: "flex-end" },
  badgeOutline: { borderWidth: 1, borderColor: "rgba(168,85,247,0.6)" },
  ratingPill: { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.bg },
});
