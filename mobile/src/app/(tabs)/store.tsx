import { LinearGradient } from "expo-linear-gradient";
import { BookOpenCheck, Coins, Lock } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { AppHeader } from "../../components/app-header";
import { GUTTER } from "../../components/layout";
import { SignInRequired } from "../../components/signin-required";
import { Loading, Panel, Row, Txt } from "../../components/ui";
import { useSession } from "../../lib/session";
import { useWallet } from "../../lib/wallet";
import { colors, lunexGradient, radius } from "../../theme";

/**
 * The site's /store ("العملات وفتح الفصول"): the balances, how reading opens chapters for free, and what a chapter costs in coins.
 * The site's "ask for coins on Discord / Telegram" part is left out on purpose: an app on Google Play may not send readers to pay for
 * digital content outside Play's own billing. Coins bought that way still show here and still open chapters.
 */
export default function StoreScreen() {
  const { status } = useSession();
  const { data: wallet } = useWallet();
  const price = wallet?.coinPrice ?? 50;
  const perCredit = wallet?.chaptersPerCredit ?? 10;
  const lockedWindow = wallet?.lockedWindow ?? 3;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      {status === "loading" ? (
        <Loading />
      ) : status !== "signedIn" ? (
        <SignInRequired text="سجّل الدخول لترى عملاتك ورصيد القراءة، وتفتح الفصول المقفلة." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: GUTTER, paddingTop: 32, gap: 24, paddingBottom: 40 }}>
          <View style={{ gap: 8 }}>
            <Txt display size={24} weight="900">
              العملات وفتح الفصول
            </Txt>
            <Txt size={14} color={colors.muted} style={{ lineHeight: 23 }}>
              أحدث {lockedWindow} فصول من كل عمل مقفلة. الفصول الأقدم مفتوحة للجميع. تفتح الفصل المقفل بإحدى طريقتين: بالقراءة أو بالعملات.
            </Txt>
          </View>

          <Panel style={{ padding: 20, gap: 16 }}>
            <Row gap={16}>
              <View style={{ flex: 1, gap: 4 }}>
                <Row gap={6}>
                  <Coins size={14} color="#facc15" />
                  <Txt size={12} color={colors.muted}>
                    عملاتك
                  </Txt>
                </Row>
                <Txt display size={24} weight="900">
                  {wallet?.coins ?? 0}
                </Txt>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Row gap={6}>
                  <BookOpenCheck size={14} color="#34d399" />
                  <Txt size={12} color={colors.muted}>
                    رصيد القراءة
                  </Txt>
                </Row>
                <Txt display size={24} weight="900">
                  {wallet?.unlockCredits ?? 0}
                </Txt>
              </View>
            </Row>
            <View style={{ gap: 6 }}>
              <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.white10, overflow: "hidden" }}>
                <LinearGradient
                  {...lunexGradient}
                  style={{ height: 8, width: `${Math.min(100, ((wallet?.creditProgress ?? 0) / perCredit) * 100)}%`, alignSelf: "flex-end" }}
                />
              </View>
              <Txt size={12} color={colors.muted}>
                {wallet?.creditProgress ?? 0} من {perCredit} فصول للرصيد القادم.
              </Txt>
            </View>
          </Panel>

          <Panel style={{ padding: 20, gap: 10 }}>
            <Row gap={8}>
              <BookOpenCheck size={16} color="#34d399" />
              <Txt display size={16} weight="700">
                افتح بالقراءة (مجانًا)
              </Txt>
            </Row>
            <Txt size={14} color={colors.muted} style={{ lineHeight: 23 }}>
              كل{" "}
              <Txt size={14} weight="700">
                {perCredit} فصول
              </Txt>{" "}
              تُنهيها (تصل فيها إلى نهاية الفصل) تمنحك رصيد قراءة واحدًا، وكل رصيد يفتح فصلًا مقفلًا واحدًا.
            </Txt>
            <Txt size={14} color={colors.muted} style={{ lineHeight: 23 }}>
              يُحسب الفصل مرة واحدة فقط، فإعادة قراءة فصل أنهيته لا تزيد رصيدك، وتُحسب الفصول من النهاية الفعلية لا من فتح الصفحة.
            </Txt>
          </Panel>

          <Panel style={{ padding: 20, gap: 10 }}>
            <Row gap={8}>
              <Coins size={16} color="#facc15" />
              <Txt display size={16} weight="700">
                افتح بالعملات
              </Txt>
            </Row>
            <Txt size={14} color={colors.muted} style={{ lineHeight: 23 }}>
              فتح الفصل الواحد يكلّف{" "}
              <Txt size={14} weight="700">
                {price} عملة
              </Txt>
              . العملات في حسابك تفتح الفصول هنا وعلى الموقع.
            </Txt>
          </Panel>

          <Row gap={6} style={{ justifyContent: "center" }}>
            <Lock size={14} color={colors.muted} />
            <Txt size={12} color={colors.muted}>
              الفصل الذي تفتحه يبقى مفتوحًا لحسابك.
            </Txt>
          </Row>
        </ScrollView>
      )}
    </View>
  );
}
