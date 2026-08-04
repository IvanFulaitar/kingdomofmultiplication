import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { playModalOpen, playModalClose, playPurchaseSuccess, playInsufficientCoins, playUiClick } from "../game/sfx.js";
import ArtImage from "./ArtImage.jsx";

const LOW_BALANCE_THRESHOLD = 30;
const CONFIRM_DELAY_MS = 450;

const SPARKLES = [
  { top: "-4%", left: "6%", size: 10, delay: "0s" },
  { top: "8%", left: "92%", size: 8, delay: "0.4s" },
  { top: "78%", left: "-2%", size: 9, delay: "0.9s" },
  { top: "88%", left: "88%", size: 7, delay: "1.3s" },
];

function Sparkles() {
  return (
    <>
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="avatar-modal-sparkle"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

// Універсальна модалка підтвердження покупки — один компонент для всіх
// аватарів магазину. Ніяка покупка не виконується без явного натискання
// кнопки "Придбати"; сама модалка лише показує ціну/баланс і сигналізує
// про рішення гравця через onConfirm/onCancel/onSelect.
export default function AvatarPurchaseModal({
  avatarId,
  avatarName,
  avatarImage,
  avatarFallback = "🧙",
  price,
  currentBalance,
  isOwned = false,
  isSelected = false,
  onConfirm,
  onCancel,
  onSelect,
}) {
  const { t } = useTranslation(["shop", "common"]);
  const canAfford = isOwned || currentBalance >= price;
  const [phase, setPhase] = useState(() => (canAfford ? "confirm" : "insufficient"));
  const [loading, setLoading] = useState(false);
  const closingRef = useRef(false);

  // Поки модалка відкрита, сайт позаду не прокручується — так само, як
  // в інших модалках гри (BadgesModal, ExitConfirmModal).
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    playModalOpen();
    if (phase === "insufficient") setTimeout(playInsufficientCoins, 200);
    return () => { document.body.style.overflow = original; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Закриття: Escape на комп'ютері й системна кнопка "Назад" на телефоні —
  // жодне з них не підтверджує покупку, обидва лише закривають модалку.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") safeClose();
    }
    window.history.pushState({ modal: "avatar-purchase" }, "");
    function handlePopState() { safeClose(); }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function safeClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    playModalClose();
    onCancel();
  }

  function handleConfirmClick() {
    if (loading || phase !== "confirm") return;
    setLoading(true);
    // Короткий стан завантаження — і захист від подвійної покупки:
    // кнопка вимикається одразу, onConfirm() виконується рівно один раз.
    setTimeout(() => {
      const success = onConfirm();
      setLoading(false);
      setPhase(success ? "success" : "insufficient");
      if (success) playPurchaseSuccess(); else playInsufficientCoins();
    }, CONFIRM_DELAY_MS);
  }

  function handleSelectNow() {
    playUiClick();
    onSelect();
    safeClose();
  }

  const remainder = currentBalance - price;
  const lowBalance = remainder >= 0 && remainder <= LOW_BALANCE_THRESHOLD;
  const missing = Math.max(0, price - currentBalance);

  return (
    <div
      className="exit-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center px-5 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={t("shop:purchaseAvatarAria")}
      onClick={safeClose}
    >
      <div
        className="exit-modal-panel relative w-full max-w-sm rounded-3xl px-5 pt-11 pb-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={safeClose}
          aria-label={t("common:close")}
          className="modal-x-button absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10"
        >
          ✕
        </button>

        <div className="relative w-28 h-28 mx-auto mb-4">
          <div className={`avatar-modal-portrait absolute inset-0 rounded-full flex items-center justify-center ${phase === "success" ? "avatar-modal-portrait-success" : ""}`}>
            <ArtImage
              src={avatarImage}
              fallback={avatarFallback}
              alt={avatarName}
              className="w-[72%] h-[72%] object-contain text-6xl flex items-center justify-center"
            />
          </div>
          {phase !== "insufficient" && <Sparkles />}
          {phase === "success" && (
            <span className="avatar-modal-check absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center text-white text-lg font-bold">
              ✓
            </span>
          )}
        </div>

        {phase === "insufficient" && (
          <>
            <h2 className="font-display gold-text text-2xl font-extrabold leading-tight mb-1">{t("shop:insufficientTitle")}</h2>
            <div className="text-amber-200/90 font-display font-bold text-base mb-3">{avatarName}</div>
            <div className="exit-progress-panel rounded-2xl px-4 py-3 mb-5 text-left space-y-1.5">
              <div className="font-body text-white text-sm"><Trans i18nKey="shop:needCoins" values={{ price }} components={{ b: <b /> }} /></div>
              <div className="font-body text-white text-sm"><Trans i18nKey="shop:haveCoinsNow" values={{ balance: currentBalance }} components={{ b: <b /> }} /></div>
              <div className="font-body text-rose-200 text-sm font-bold">{t("shop:missingCoins", { missing })}</div>
            </div>
            <p className="text-violet-200/80 text-xs mb-5">{t("shop:earnCoinsHint")}</p>
            <button
              onClick={safeClose}
              className="exit-continue-button relative rounded-2xl py-3.5 px-4 font-display font-extrabold text-indigo-950 w-full"
            >
              {t("shop:gotIt")}
            </button>
          </>
        )}

        {phase === "confirm" && (
          <>
            <h2 className="font-display gold-text text-2xl font-extrabold leading-tight mb-1">{t("shop:confirmTitle")}</h2>
            <div className="text-amber-200/90 font-display font-bold text-base mb-4">{avatarName}</div>

            <div className="flex items-center justify-center gap-2 mb-3">
              <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt="" className="w-6 h-6 object-contain" />
              <span className="font-display font-extrabold text-xl text-amber-100">{t("shop:priceLabel", { price })}</span>
            </div>

            <div className="exit-progress-panel rounded-2xl px-4 py-3 mb-5 text-left space-y-1.5">
              <div className="font-body text-violet-100 text-sm">
                <Trans i18nKey="shop:balanceLine" values={{ balance: currentBalance }} components={{ b: <b className="text-white" /> }} />
              </div>
              {lowBalance ? (
                <div className="font-body text-amber-200 text-sm font-bold">{t("shop:lowBalanceWarning")}</div>
              ) : (
                <div className="font-body text-sm">
                  <Trans i18nKey="shop:remainderLine" values={{ remainder }} components={{ b: <b className="text-emerald-300" /> }} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmClick}
                disabled={loading}
                className="exit-continue-button relative rounded-2xl py-3.5 px-4 font-display font-extrabold text-indigo-950 flex items-center justify-center gap-2.5 disabled:opacity-80"
              >
                {loading ? (
                  t("shop:buying")
                ) : (
                  <>
                    <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt="" className="w-5 h-5 object-contain" />
                    {t("shop:buyFor", { price })}
                  </>
                )}
              </button>
              <button
                onClick={safeClose}
                disabled={loading}
                className="exit-confirm-button rounded-2xl py-3 px-4 font-display font-bold text-base disabled:opacity-60"
              >
                {t("common:cancel")}
              </button>
            </div>
          </>
        )}

        {phase === "success" && (
          <>
            <h2 className="font-display gold-text text-2xl font-extrabold leading-tight mb-1">{t("shop:purchaseSuccessTitle")}</h2>
            <div className="text-amber-200/90 font-display font-bold text-base mb-1">{avatarName}</div>
            <p className="text-violet-200 text-sm mb-4">{t("shop:purchaseSuccessHint")}</p>

            <div className="exit-progress-panel rounded-2xl px-4 py-3 mb-5">
              <div className="font-body text-violet-100 text-sm">
                <Trans i18nKey="shop:balanceLine" values={{ balance: currentBalance }} components={{ b: <b className="text-white" /> }} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSelectNow}
                className="exit-continue-button relative rounded-2xl py-3.5 px-4 font-display font-extrabold text-indigo-950"
              >
                {t("shop:selectNow")}
              </button>
              <button
                onClick={safeClose}
                className="exit-confirm-button rounded-2xl py-3 px-4 font-display font-bold text-base"
              >
                {t("shop:saveForLater")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
