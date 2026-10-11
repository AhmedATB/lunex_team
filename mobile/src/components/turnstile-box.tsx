import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { SITE_URL, TURNSTILE_SITE_KEY } from "../lib/config";
import { colors } from "../theme";
import { Txt } from "./ui";

/**
 * Cloudflare's widget, in a small web view. The page is loaded as the site's own origin (`baseUrl`), so the widget's hostname
 * check passes exactly as it does on lunexteam.com, and the token it hands back is the same kind the site's forms send.
 */
function widgetHtml(action: string): string {
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:0;background:${colors.bg};overflow:hidden}#box{display:flex;justify-content:center}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=start" async defer></script>
</head><body><div id="box"></div><script>
function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))}
function start(){turnstile.render('#box',{sitekey:${JSON.stringify(TURNSTILE_SITE_KEY)},action:${JSON.stringify(action)},theme:'dark',language:'ar',size:'flexible',
callback:function(t){send({token:t})},'expired-callback':function(){send({token:null})},'timeout-callback':function(){send({token:null})},
'error-callback':function(){send({error:true})}})}
</script></body></html>`;
}

export function TurnstileBox({
  action,
  onToken,
  resetKey = 0,
}: {
  /** Names the form ("login", "register", "forgot"); the backend checks the token was earned for this one. */
  action: string;
  onToken: (token: string | null) => void;
  /** Raise after every submit: a token works once, so the widget starts over. */
  resetKey?: number;
}) {
  const report = useRef(onToken);
  report.current = onToken;
  const [problem, setProblem] = useState(false);

  useEffect(() => {
    report.current(null);
    setProblem(false);
  }, [resetKey]);

  function onMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { token?: string | null; error?: boolean };
      if (message.error) {
        setProblem(true);
        report.current(null);
      } else report.current(message.token ?? null);
    } catch {
      // not ours
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 70, borderRadius: 10, overflow: "hidden" }}>
        <WebView
          key={resetKey}
          source={{ html: widgetHtml(action), baseUrl: SITE_URL }}
          originWhitelist={["*"]}
          onMessage={onMessage}
          javaScriptEnabled
          scrollEnabled={false}
          style={{ backgroundColor: colors.bg }}
          onError={() => setProblem(true)}
        />
      </View>
      {problem && (
        <Txt size={12} color={colors.warning}>
          تعذر تحميل مربع التحقق. تأكد من الإنترنت ثم أعد فتح الصفحة.
        </Txt>
      )}
    </View>
  );
}
