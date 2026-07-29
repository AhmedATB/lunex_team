/** Curated, fixed seeds for the avatar picker — stable across reloads since the seed never changes. */
export const AVATAR_PRESET_SEEDS: string[] = Array.from(
  { length: 24 },
  (_, i) => `lunex-avatar-preset-${i + 1}`
);
