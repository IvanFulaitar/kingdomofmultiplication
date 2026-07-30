import { useState } from "react";

// Показує реальну картинку з /public/assets/..., якщо вона існує.
// Якщо файл ще не додано (404) — тихо показує emoji-заміну (fallback),
// нічого не ламаючи. Коли з'явиться справжня графіка — просто покласти
// файл із правильною назвою в public/assets/, і код сам її підхопить,
// без жодних правок компонентів.
export default function ArtImage({ src, fallback, alt = "", className = "", fetchPriority, style }) {
  const [errored, setErrored] = useState(false);

  if (errored || !src) {
    return <span className={className} style={style}>{fallback}</span>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setErrored(true)}
      draggable={false}
      fetchPriority={fetchPriority}
    />
  );
}
