import { useEffect } from "react";

const MENS_URL = "https://human-kind-companion.lovable.app";

const MensRedirect = () => {
  useEffect(() => {
    window.location.replace(MENS_URL);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <p className="text-lg font-medium">Je wordt doorgestuurd naar Mens-Erger-Je-Niet 3D…</p>
      <a href={MENS_URL} className="text-primary underline">
        Klik hier als je niet automatisch wordt doorgestuurd
      </a>
    </div>
  );
};

export default MensRedirect;
