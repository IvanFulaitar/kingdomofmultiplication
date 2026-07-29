import ArtImage from "./ArtImage.jsx";

export default function Coin({ children }) {
  return (
    <span className="inline-flex items-center gap-1 bg-gradient-to-b from-amber-300 to-amber-600 border border-amber-100/70 text-amber-950 font-body font-extrabold px-2.5 py-1 rounded-full text-sm shadow">
      <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt="монета" className="w-4 h-4 object-contain inline-flex items-center justify-center" />
      {children}
    </span>
  );
}
