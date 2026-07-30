import ArtImage from "./ArtImage.jsx";

// Мальовані значки об'єктів "Лабіринту" — принципово без emoji. Де можна,
// перевикористовуємо вже наявну графіку з /assets/icons/ui/ (навіщо
// генерувати те, що вже є). Для понять, яких ще немає (ключ/пастка/
// портал), показуємо чисті CSS-фігури в стилі решти гри — і вони самі
// зникнуть, щойно з'являться файли /assets/icons/maze/<type>.png.
const EXISTING_ASSET = {
  coin: "/assets/icons/ui/coin.png",
  heart: "/assets/icons/ui/heart_full.png",
  hint: "/assets/icons/ui/hint_lightbulb.png",
  lock: "/assets/icons/ui/lock.png",
  chest: "/assets/icons/ui/chest.png",
  // Секретна скриня = та сама графіка скрині з фіолетовим сяйвом (CSS-тюнінг),
  // окремий файл для неї не потрібен.
  secret: "/assets/icons/ui/chest.png",
};
const EXTRA_CLASS = { secret: "maze-secret-tint" };

const SHAPES = {
  key: <span className="maze-icon maze-icon-key" />,
  trap: <span className="maze-icon maze-icon-trap" />,
  portal: <span className="maze-icon maze-icon-portal" />,
  exit: <span className="maze-icon maze-icon-exit" />,
  shield: <span className="maze-icon maze-icon-shield" />,
  lightning: <span className="maze-icon maze-icon-lightning" />,
};

export default function MazeIcon({ type, className = "" }) {
  if (type === "treasure") {
    return (
      <span className={`maze-icon maze-icon-treasure ${className}`}>
        <ArtImage src="/assets/icons/ui/coin.png" fallback="" alt="" className="maze-treasure-coin maze-treasure-coin-a" />
        <ArtImage src="/assets/icons/ui/coin.png" fallback="" alt="" className="maze-treasure-coin maze-treasure-coin-b" />
        <ArtImage src="/assets/icons/ui/coin.png" fallback="" alt="" className="maze-treasure-coin maze-treasure-coin-c" />
      </span>
    );
  }
  const src = EXISTING_ASSET[type] ?? `/assets/icons/maze/${type}.png`;
  const extra = EXTRA_CLASS[type] ?? "";
  return <ArtImage src={src} fallback={SHAPES[type] ?? null} alt="" className={`${className} ${extra}`.trim()} />;
}
