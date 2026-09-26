/**
 * Keeps the tab's title the page's own. Some advertising scripts change it to a lure such as "(1) New Message!" to make
 * a visitor think the site has something for them; a member who has just read their messages would then see a "new
 * message" that is not one. The site's own titles never look like that, so anything that does is put back.
 */
const LURE = /\bnew\s+messages?\b|\bunread\b|^\s*\(\d+\)|\bnotifications?\b/i;

export function installTitleGuard(): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "title");
  if (!descriptor?.get || !descriptor.set) return () => {};
  const read = () => descriptor.get!.call(document) as string;
  const write = (value: string) => descriptor.set!.call(document, value);

  let lastGood = read();
  let restoring = false;

  // A script assigning `document.title = ...`
  Object.defineProperty(document, "title", {
    configurable: true,
    get: read,
    set(value: unknown) {
      const text = String(value);
      if (LURE.test(text)) return;
      lastGood = text;
      write(text);
    },
  });

  // A script (or the framework) editing the <title> element directly
  const observer = new MutationObserver(() => {
    if (restoring) return;
    const current = read();
    if (LURE.test(current)) {
      restoring = true;
      write(lastGood);
      restoring = false;
    } else {
      lastGood = current;
    }
  });
  observer.observe(document.head, { subtree: true, childList: true, characterData: true });

  return () => {
    observer.disconnect();
    delete (document as unknown as { title?: string }).title;
  };
}
