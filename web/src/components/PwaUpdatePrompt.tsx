import { Button } from "@mui/joy";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useTranslate } from "@/utils/i18n";

const TOAST_ID = "pwa-update";

// Shows a "new version available" toast when a service worker is waiting. Never reloads on its own.
const PwaUpdatePrompt = () => {
  const t = useTranslate();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) {
      return;
    }
    toast(
      () => (
        <div className="flex items-center gap-3">
          <span>{t("pwa.new-version-available")}</span>
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            {t("pwa.refresh")}
          </Button>
        </div>
      ),
      { id: TOAST_ID, duration: Infinity },
    );
  }, [needRefresh]);

  return null;
};

export default PwaUpdatePrompt;
