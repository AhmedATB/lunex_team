import { router } from "expo-router";
import { useEffect } from "react";
import { Loading } from "../components/ui";

/**
 * Where the phone's browser sends the reader back after a Discord/Google sign-in (`lunex://auth?code=…`). The sign-in itself
 * picks the link up (lib/oauth.ts); this screen only exists so the router has somewhere to land if the link also reaches it,
 * and steps straight back out.
 */
export default function AuthReturn() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);
  return <Loading />;
}
