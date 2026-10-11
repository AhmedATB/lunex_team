import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, radius } from "../theme";

/**
 * The app is laid out right-to-left by hand instead of through I18nManager: Expo Go resets the RTL setting every time it opens a
 * project, so a forced-RTL app would look mirrored there and right in the store build. Laying rows out with `row-reverse` and
 * aligning text to the right looks the same in both.
 */
export function Txt({
  style,
  weight,
  size = 15,
  color = colors.text,
  ...rest
}: TextProps & { weight?: "400" | "600" | "700" | "800"; size?: number; color?: string }) {
  return <Text {...rest} style={[styles.text, { fontSize: size, color, fontWeight: weight ?? "400" }, style]} />;
}

/** A right-to-left row. */
export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row-reverse", alignItems: "center", gap }, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost";
  style?: StyleProp<ViewStyle>;
}) {
  const ghost = variant === "ghost";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        ghost ? styles.buttonGhost : styles.buttonPrimary,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <Txt weight="700">{label}</Txt>}
    </Pressable>
  );
}

export function Centered({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.centered, style]}>{children}</View>;
}

export function Loading() {
  return (
    <Centered>
      <ActivityIndicator size="large" color={colors.violet} />
    </Centered>
  );
}

export function ErrorState({ message = "تعذر تحميل المحتوى.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Centered style={{ gap: 12 }}>
      <Txt color={colors.muted} style={{ textAlign: "center" }}>
        {message}
      </Txt>
      {onRetry && <Button label="إعادة المحاولة" variant="ghost" onPress={onRetry} />}
    </Centered>
  );
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Txt size={18} weight="800" style={[{ paddingHorizontal: 16, marginBottom: 10 }, style]}>
      {children}
    </Txt>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: "right", writingDirection: "rtl" },
  button: { height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonGhost: { borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.bg },
});
