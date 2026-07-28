const STAR_COLORS = ["#f0abfc", "#c084fc", "#fcd34d", "#e9d5ff"];

const STARS = Array.from({ length: 34 }).map((_, i) => {
  let seed = i * 9301 + 49297;
  const rand = () => {
    seed = (seed * 233280) % 1000000;
    return seed / 1000000;
  };
  return {
    id: i,
    top: `${rand() * 100}%`,
    left: `${rand() * 100}%`,
    size: 8 + rand() * 16,
    delay: `${rand() * 4}s`,
    duration: `${2 + rand() * 2.6}s`,
    color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)],
  };
});

export function SparkleField() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
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
    </div>
  );
}
