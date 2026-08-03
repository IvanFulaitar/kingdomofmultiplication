import { useTranslation } from "react-i18next";
import ArtImage from "./ArtImage.jsx";

export default function StarIcon({ filled }) {
  const { t } = useTranslation("common");
  return (
    <ArtImage
      src="/assets/icons/ui/star.png"
      fallback="⭐"
      alt={t("starAlt")}
      className={filled ? "text-2xl w-6 h-6 object-contain inline-flex items-center justify-center" : "text-2xl w-6 h-6 object-contain inline-flex items-center justify-center opacity-25"}
    />
  );
}
