import ArtImage from "./ArtImage.jsx";

export default function LockBadge() {
  return (
    <span className="lock-badge" aria-hidden="true">
      <ArtImage src="/assets/icons/ui/lock.png" fallback="🔒" alt="" className="w-3.5 h-3.5 object-contain inline-flex items-center justify-center" />
    </span>
  );
}
