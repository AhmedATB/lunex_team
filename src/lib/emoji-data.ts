/**
 * The emoji the chat offers, by group. Plain Unicode (nothing is downloaded and no third party is asked for a picture), all of them old
 * enough to draw on any phone still in use; each phone draws them in its own set.
 */
export interface EmojiGroup {
  id: string;
  label: string;
  /** The emoji that stands for the group in the tab bar. */
  icon: string;
  emojis: string[];
}

const list = (text: string) => text.split(/\s+/).filter(Boolean);

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: "smileys",
    label: "وجوه",
    icon: "😀",
    emojis: list(
      "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👹 👺 👻 👽 👾 🤖"
    ),
  },
  {
    id: "people",
    label: "أيدي وناس",
    icon: "👋",
    emojis: list(
      "👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✍️ 💪 👏 🙌 👐 🤲 🤜 🤛 ✊ 👊 👀 👁️ 👂 👃 👄 🦷 🧠 👶 🧒 👦 👧 🧑 👨 👩 🧔 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🙇 🤦 🤷 💃 🕺 🚶 🏃"
    ),
  },
  {
    id: "hearts",
    label: "قلوب ورموز",
    icon: "❤️",
    emojis: list(
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💋 💯 💢 💥 💫 💦 💨 💬 💭 💤 ✨ 🌟 ⭐ 🔥 🎉 🎊 🎁 🎈"
    ),
  },
  {
    id: "animals",
    label: "حيوانات وطبيعة",
    icon: "🐶",
    emojis: list(
      "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🦈 🐊 🐘 🦒 🐪 🌵 🌲 🌳 🌴 🌱 🍀 🌷 🌹 🌺 🌸 🌼 🌻 🌞 🌙 ☁️ ⛅ 🌈 ⚡ ❄️ 🌊"
    ),
  },
  {
    id: "food",
    label: "طعام",
    icon: "🍔",
    emojis: list(
      "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥕 🌽 🍞 🧀 🍳 🥞 🍗 🍖 🌭 🍔 🍟 🍕 🌮 🌯 🥗 🍝 🍜 🍲 🍣 🍱 🍚 🍙 🍦 🍩 🍪 🎂 🍰 🍫 🍬 🍭 ☕ 🍵 🥤 🍺 🍷"
    ),
  },
  {
    id: "activities",
    label: "أنشطة",
    icon: "⚽",
    emojis: list(
      "⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🥊 🎯 🎮 🕹️ 🎲 🎨 🎬 🎤 🎧 🎵 🎶 🎸 🎹 📚 📖 ✏️ 📝 🏆 🥇 🥈 🥉 🏅"
    ),
  },
  {
    id: "objects",
    label: "أشياء وأماكن",
    icon: "🚗",
    emojis: list(
      "🚗 🚕 🚌 🚑 🚒 ✈️ 🚀 🚁 ⛵ 🏠 🏢 🏰 🕌 ⛪ 🌍 📱 💻 ⌨️ 🖥️ 📷 📺 ⏰ ⌛ 💡 🔋 💰 💳 💎 🔧 🔨 🔒 🔑 📌 📎 ✂️ 🧭 🔔 📢"
    ),
  },
  {
    id: "symbols",
    label: "علامات",
    icon: "✅",
    emojis: list(
      "✅ ❌ ❎ ⭕ ❗ ❓ ‼️ ⚠️ 🚫 ➕ ➖ ➡️ ⬅️ ⬆️ ⬇️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ ♻️ ✔️ ☑️ 🔝 🆗 🆒 🆕"
    ),
  },
];

const RECENT_KEY = "lunex-recent-emoji";
const RECENT_MAX = 24;

export function loadRecentEmoji(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Puts an emoji first in the list of the ones used lately, and returns the new list. */
export function rememberEmoji(emoji: string): string[] {
  const next = [emoji, ...loadRecentEmoji().filter((e) => e !== emoji)].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // private window, or storage is off: the list just isn't kept
  }
  return next;
}
