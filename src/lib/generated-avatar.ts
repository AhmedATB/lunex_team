/**
 * Default avatars are drawn here, in the browser or on our own server — never
 * fetched from a third-party image service (the previous i.pravatar.cc
 * placeholder received every user's account id as its seed).
 *
 * The same seed always yields the same picture: a night-sky gradient with a
 * moon at its own phase and tilt, echoing the LUNEX name. The output is a
 * self-contained `data:` URI, so it costs no network request and is identical
 * on the server and in the browser (no hydration mismatch).
 */

/** 32-bit FNV-1a — small, fast, and well spread for short strings. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic PRNG (mulberry32) so one hash can drive several independent choices. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOON_RADIUS = 24;
const cache = new Map<string, string>();

function draw(seed: string): string {
  const random = makeRandom(hashSeed(seed));
  const between = (min: number, max: number) => min + random() * (max - min);

  const hueA = Math.floor(between(0, 360));
  const hueB = (hueA + Math.floor(between(35, 85))) % 360;
  const tilt = between(-40, 40).toFixed(1);

  // The shadow disc slides across the moon: a small offset leaves a thin crescent lit, a large one leaves it almost full.
  const direction = random() < 0.5 ? -1 : 1;
  const shadowShift = (direction * between(10, 46)).toFixed(1);

  // Stars stay off the moon: keep drawing points until one lands beyond its rim. Only +, * and comparisons are used (no trig), so
  // the server and every browser engine produce byte-identical output and hydration never mismatches.
  const stars = Array.from({ length: 4 }, () => {
    const clearOfMoon = MOON_RADIUS + 9;
    let x = 0;
    let y = 0;
    do {
      x = between(4, 96);
      y = between(4, 96);
    } while ((x - 50) * (x - 50) + (y - 50) * (y - 50) < clearOfMoon * clearOfMoon);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${between(0.7, 1.5).toFixed(1)}" fill="#fff" opacity="${between(0.45, 0.9).toFixed(2)}"/>`;
  }).join("");

  const moonColor = `hsl(${hueA},45%,92%)`;
  const shadowColor = `hsl(${hueB},55%,12%)`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<defs>` +
    `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hueA},60%,38%)"/><stop offset="1" stop-color="hsl(${hueB},65%,16%)"/></linearGradient>` +
    `<radialGradient id="g"><stop offset="0" stop-color="${moonColor}" stop-opacity="0.35"/><stop offset="1" stop-color="${moonColor}" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="c"><circle cx="50" cy="50" r="${MOON_RADIUS}"/></clipPath>` +
    `</defs>` +
    `<rect width="100" height="100" fill="url(#b)"/>` +
    stars +
    `<circle cx="50" cy="50" r="${MOON_RADIUS + 12}" fill="url(#g)"/>` +
    `<g transform="rotate(${tilt} 50 50)">` +
    `<circle cx="50" cy="50" r="${MOON_RADIUS}" fill="${moonColor}"/>` +
    `<circle cx="${50 + Number(shadowShift)}" cy="50" r="${MOON_RADIUS}" fill="${shadowColor}" opacity="0.93" clip-path="url(#c)"/>` +
    `</g>` +
    `</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function generatedAvatarUri(seed: string): string {
  let uri = cache.get(seed);
  if (!uri) {
    uri = draw(seed);
    cache.set(seed, uri);
  }
  return uri;
}
