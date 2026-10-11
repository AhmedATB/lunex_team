import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { forwardRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBootstrap } from "../lib/catalog";
import { absolute } from "../lib/config";
import { colors, radius } from "../theme";
import { Row, Txt } from "./ui";

/**
 * The site's sign-in/sign-up frame (components/auth/auth-shell.tsx): faded covers behind a purple wash, the round logo with
 * "LUNEX TEAM", and the form in a dark rounded card.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { data } = useBootstrap();
  const covers = (data?.series ?? []).slice(0, 4).map((s) => s.cover);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.collage}>
          {covers.map((c, i) => (
            <Image
              key={i}
              source={absolute(c)}
              style={[styles.collageCover, { left: i % 2 ? "52%" : "-6%", top: i < 2 ? -40 : 150, transform: [{ rotate: i % 2 ? "8deg" : "-6deg" }] }]}
              contentFit="cover"
            />
          ))}
        </View>
        <LinearGradient colors={["rgba(46,16,101,0.75)", "rgba(9,7,13,0.92)", colors.bg]} locations={[0, 0.45, 0.75]} style={StyleSheet.absoluteFill} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Row gap={10} style={{ justifyContent: "center", marginBottom: 24 }}>
          <Image source={require("../../assets/brand-icon.png")} style={styles.logo} />
          <Txt display size={20} weight="700">
            LUNEX{" "}
            <Txt display size={20} weight="700" color={colors.primary400}>
              TEAM
            </Txt>
          </Txt>
        </Row>
        <View style={styles.card}>
          <View style={{ alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Txt display size={22} weight="700" align="center">
              {title}
            </Txt>
            <Txt size={14} color={colors.muted} align="center">
              {subtitle}
            </Txt>
          </View>
          {children}
        </View>
      </ScrollView>

      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={[styles.close, { top: insets.top + 8 }]} hitSlop={8}>
        <X size={20} color={colors.text} />
      </Pressable>
    </KeyboardAvoidingView>
  );
}

/** A labelled input with an icon at its start, like the site's form fields. */
export const Field = forwardRef<
  TextInput,
  TextInputProps & { label: string; icon?: ReactNode; trailing?: ReactNode; aside?: ReactNode; hint?: ReactNode; ltr?: boolean }
>(function Field({ label, icon, trailing, aside, hint, ltr, style, ...input }, ref) {
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt size={14} weight="500">
          {label}
        </Txt>
        {aside}
      </Row>
      <Row gap={8} style={styles.input}>
        {icon}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          style={[styles.inputText, { textAlign: ltr ? "left" : "right" }, style]}
          {...input}
        />
        {trailing}
      </Row>
      {hint}
    </View>
  );
});

/** "أو تابع عبر" between two lines. */
export function OrDivider({ label = "أو تابع عبر" }: { label?: string }) {
  return (
    <Row gap={10}>
      <View style={styles.line} />
      <Txt size={12} color={colors.muted}>
        {label}
      </Txt>
      <View style={styles.line} />
    </Row>
  );
}

const styles = StyleSheet.create({
  collage: { height: 360, overflow: "hidden", opacity: 0.35 },
  collageCover: { position: "absolute", width: "54%", aspectRatio: 3 / 4, borderRadius: 20 },
  scroll: { flexGrow: 1, paddingHorizontal: 16 },
  logo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "rgba(168,85,247,0.5)" },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(17,11,25,0.92)",
    padding: 20,
    paddingTop: 24,
    gap: 18,
  },
  input: {
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
  },
  inputText: { flex: 1, color: colors.text, fontFamily: "Tajawal_400Regular", fontSize: 15, height: "100%" },
  line: { flex: 1, height: 1, backgroundColor: colors.white10 },
  close: { position: "absolute", left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
});
