import ArtImage from "./ArtImage.jsx";

export default function StarIcon({ filled }) {
  return (
    <ArtImage
      src="/assets/icons/ui/star.png"
      fallback="⭐"
      alt="зірка"
      className={filled ? "text-2xl w-6 h-6 object-contain inline-flex items-center justify-center" : "text-2xl w-6 h-6 object-contain inline-flex items-center justify-center opacity-25"}
    />
  );
}
