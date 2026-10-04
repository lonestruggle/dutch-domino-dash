import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const MENS_URL = "https://human-kind-companion.lovable.app";

const MensRedirect = () => {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    document.title = t("mens.pageTitle");
  }, [t]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background text-foreground">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-lg font-medium">{t("mens.loading")}</p>
        </div>
      )}
      <iframe
        src={MENS_URL}
        title={t("mens.pageTitle")}
        className="h-full w-full border-0"
        allow="fullscreen; autoplay; gamepad"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
};

export default MensRedirect;
