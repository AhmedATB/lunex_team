// Deterministic PRNG so mock data is stable across server/client renders and reloads.
export function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export class Rand {
  private rand: () => number;
  constructor(seed: number | string) {
    this.rand = mulberry32(typeof seed === "string" ? hashString(seed) : seed);
  }
  next() {
    return this.rand();
  }
  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  float(min: number, max: number, decimals = 1) {
    const v = this.next() * (max - min) + min;
    return Number(v.toFixed(decimals));
  }
  bool(probability = 0.5) {
    return this.next() < probability;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  pickMany<T>(arr: readonly T[], count: number): T[] {
    const pool = [...arr];
    const out: T[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(this.next() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
