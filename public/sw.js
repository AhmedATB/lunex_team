/*
 * LUNEX TEAM — the worker that shows notifications on a phone or computer while the site is closed (Web Push).
 * It does nothing else: no caching, no offline pages, no interception of requests.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** Only a path on this site is ever opened from a notification, whatever the message says. */
function safePath(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "LUNEX TEAM";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : undefined,
      icon: "/icons/icon-192.png",
      // A picture that comes with it (a new chapter's featured picture): a path on this site only.
      image: typeof data.image === "string" && data.image.startsWith("/") && !data.image.startsWith("//") ? data.image : undefined,
      // A newer notification with the same tag replaces the one still showing (one line per chat, not one per message).
      tag: typeof data.tag === "string" ? data.tag : undefined,
      renotify: typeof data.tag === "string",
      dir: "rtl",
      lang: "ar",
      data: { url: safePath(data.url) },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // A tab of the site is already open: use it rather than opening another.
      for (const client of open) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
