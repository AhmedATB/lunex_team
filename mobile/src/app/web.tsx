import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowRight, RotateCw } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Row, Txt } from "../components/ui";
import { SITE_URL } from "../lib/config";
import { useSession } from "../lib/session";
import { colors } from "../theme";

/** Added to the web view's User-Agent; the site then leaves out its own frame, ads and cookie banner (site: lib/in-app.ts). */
const APP_UA = "LunexApp/1.0";

const SITE_HOST = new URL(SITE_URL).host;

/**
 * Where a link inside a site page should go instead: the app has its own screens for reading, the catalogue and signing in, so
 * those open natively; everything else stays in the page. Returns true when the app took the link over.
 */
function routeNatively(url: URL): boolean {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const chapter = /^\/series\/([^/]+)\/([^/]+)$/.exec(path);
  if (chapter) {
    router.push({ pathname: "/read/[chapterId]", params: { chapterId: "by-number", slug: decodeURIComponent(chapter[1]), number: decodeURIComponent(chapter[2]) } });
    return true;
  }
  const series = /^\/series\/([^/]+)$/.exec(path);
  if (series) {
    router.push({ pathname: "/series/[slug]", params: { slug: decodeURIComponent(series[1]) } });
    return true;
  }
  if (path === "/") return router.navigate("/"), true;
  if (path === "/series") return router.navigate({ pathname: "/explore", params: Object.fromEntries(url.searchParams) }), true;
  if (path === "/search") return router.push("/search"), true;
  if (path === "/bookmarks") return router.navigate("/bookmarks"), true;
  if (path === "/store") return router.navigate("/store"), true;
  if (path === "/profile") return router.navigate("/account"), true;
  if (path === "/login") return router.push("/login"), true;
  if (path === "/register") return router.push("/register"), true;
  if (path === "/forgot-password") return router.push("/forgot-password"), true;
  return false;
}

/**
 * One of the site's pages inside the app (settings, notifications, messages, news, team dashboards, admin…), signed in with the
 * same session: on Android the web view and the app's own requests share one cookie store. The page drops its own frame; this
 * screen gives it the app's.
 */
export default function WebScreen() {
  const { path = "/", title = "" } = useLocalSearchParams<{ path: string; title?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { reload } = useSession();
  const web = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageTitle, setPageTitle] = useState(title);

  // Android's back button walks back through the page's own history first.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      web.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  // Whatever was changed in the page (name, avatar, password, notifications read…) shows in the app once the reader leaves it.
  useEffect(
    () => () => {
      void reload();
      void queryClient.invalidateQueries();
    },
    [reload, queryClient],
  );

  function onShouldStartLoad(request: WebViewNavigation): boolean {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return true;
    }
    if (url.protocol === "about:" || url.protocol === "data:" || url.protocol === "blob:") return true;
    if (url.host !== SITE_HOST) {
      // Discord, Telegram, a provider's sign-in page…: the phone's browser, not this view.
      if (url.protocol === "http:" || url.protocol === "https:") void WebBrowser.openBrowserAsync(request.url);
      return false;
    }
    // The first load is the page this screen was opened for; only links followed from it are taken over.
    if (request.url === `${SITE_URL}${path}`) return true;
    return !routeNatively(url);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <Row gap={8} style={{ height: 56, paddingHorizontal: 12 }}>
          <Pressable onPress={() => (canGoBack ? web.current?.goBack() : router.back())} hitSlop={8} style={styles.iconBtn}>
            <ArrowRight size={22} color={colors.text} />
          </Pressable>
          <Txt display size={17} weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {pageTitle}
          </Txt>
          {loading ? (
            <ActivityIndicator color={colors.primary400} style={styles.iconBtn} />
          ) : (
            <Pressable onPress={() => web.current?.reload()} hitSlop={8} style={styles.iconBtn}>
              <RotateCw size={18} color={colors.muted} />
            </Pressable>
          )}
        </Row>
      </View>
      <WebView
        ref={web}
        source={{ uri: `${SITE_URL}${path}` }}
        applicationNameForUserAgent={APP_UA}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={onShouldStartLoad}
        onNavigationStateChange={(nav) => {
          setCanGoBack(nav.canGoBack);
          if (!title && nav.title && !nav.title.startsWith("http")) setPageTitle(nav.title.replace(/\s*\|\s*LUNEX TEAM$/, ""));
        }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        style={{ flex: 1, backgroundColor: colors.bg }}
        containerStyle={{ backgroundColor: colors.bg }}
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }]}>
            <ActivityIndicator size="large" color={colors.primary400} />
          </View>
        )}
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: "rgba(9,7,13,0.96)", borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
