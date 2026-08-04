import { useEffect, useState } from "react";
import {
  onInstallAvailable, promptInstall, isIosInstallHintAvailable,
  isIosSafariBrowser, isAppInstalled,
} from "../game/pwa.js";

// Логіка кнопки "Встановити гру" (MenuScreen.jsx, попап налаштувань) —
// винесена в окремий хук, а не залишена прямо в компоненті, щоб розгалуження
// "яку модалку відкрити" не заважало решті MenuScreen.jsx.
//
// Технічні деталі (beforeinstallprompt, standalone-режим тощо) лишаються
// повністю всередині src/game/pwa.js — сюди й далі в компонент
// потрапляють лише прості прапорці й обробник кліку.
export function useInstallFlow() {
  const [installAvailable, setInstallAvailable] = useState(false);
  const [iosInstallOpen, setIosInstallOpen] = useState(false);
  const [openInSafariOpen, setOpenInSafariOpen] = useState(false);
  // Пристрій/браузер і "чи вже встановлено" не змінюються протягом сесії —
  // одноразове читання при монтуванні достатнє, ефект не потрібен.
  const [iosInstallable] = useState(() => isIosInstallHintAvailable());
  const [iosSafari] = useState(() => isIosSafariBrowser());
  const [appInstalled] = useState(() => isAppInstalled());

  useEffect(() => onInstallAvailable(setInstallAvailable), []);

  const canInstall = !appInstalled && (installAvailable || iosInstallable);

  async function handleInstallClick() {
    if (appInstalled) return;

    if (iosInstallable) {
      if (iosSafari) {
        setIosInstallOpen(true);
      } else {
        setOpenInSafariOpen(true);
      }
      return;
    }

    await promptInstall();
  }

  return {
    appInstalled,
    canInstall,
    handleInstallClick,
    iosInstallOpen,
    setIosInstallOpen,
    openInSafariOpen,
    setOpenInSafariOpen,
  };
}
