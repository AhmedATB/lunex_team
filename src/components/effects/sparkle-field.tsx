const STAR_COLORS = ["#f0abfc", "#c084fc", "#fcd34d", "#e9d5ff", "#a855f7"];

function makeRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const STARS = Array.from({ length: 70 }).map((_, i) => {
  const rand = makeRand(i * 9301 + 49297);
  return {
    id: `star-${i}`,
    top: `${rand() * 100}%`,
    left: `${rand() * 100}%`,
    size: 7 + rand() * 15,
    delay: `${rand() * 5}s`,
    duration: `${1.8 + rand() * 2.8}s`,
    color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)],
  };
});

const CRYSTALS = Array.from({ length: 18 }).map((_, i) => {
  const rand = makeRand(i * 6151 + 12007);
  return {
    id: `crystal-${i}`,
    top: `${rand() * 100}%`,
    left: `${rand() * 100}%`,
    size: 10 + rand() * 14,
    delay: `${rand() * 6}s`,
    duration: `${5 + rand() * 3}s`,
    color: rand() > 0.5 ? "#c084fc" : "#f0abfc",
  };
});

export function SparkleField() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {STARS.map((s) => (
        <svg
          key={s.id}
          className="sparkle-star absolute"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            color: s.color,
            animationDelay: s.delay,
            animationDuration: s.duration,
            filter: `drop-shadow(0 0 ${s.size / 2}px ${s.color})`,
          }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0c0 6.075 5.925 12 12 12-6.075 0-12 5.925-12 12 0-6.075-5.925-12-12-12C6.075 12 12 6.075 12 0z" />
        </svg>
      ))}
      {CRYSTALS.map((c) => (
        <svg
          key={c.id}
          className="float-slow absolute opacity-40"
          style={{
            top: c.top,
            left: c.left,
            width: c.size,
            height: c.size,
            color: c.color,
            animationDelay: c.delay,
            animationDuration: c.duration,
            filter: `drop-shadow(0 0 ${c.size / 2}px ${c.color})`,
          }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 1 L20 8 L12 23 L4 8 Z" />
        </svg>
      ))}
    </div>
  );
}
