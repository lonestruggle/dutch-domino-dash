import Lottie from 'lottie-react';
import hardSlamHandAnimation from '@/assets/lottie/hard-slam-hand.json';

type HardSlamHandLottieProps = {
  /** Bump to replay the one-shot animation from the start. */
  playKey: number;
  /** Multiplier for base size (ties into bestaande Hard Slam handschoen-instelling). */
  scale?: number;
  className?: string;
};

/**
 * Hard-slam moment: Lottie van de Noto Emoji “boksende vuist” (Unicode U+1F44A).
 * Bron: Google Fonts (fonts.gstatic.com static emoji Lottie); SIL Open Font License.
 */
export function HardSlamHandLottie({ playKey, scale = 1, className }: HardSlamHandLottieProps) {
  const px = Math.round(128 * Math.max(0.4, Math.min(2.5, scale)));

  return (
    <div className={className} style={{ width: px, height: px }}>
      <Lottie
        key={playKey}
        animationData={hardSlamHandAnimation as object}
        loop={false}
        autoplay
        className="h-full w-full [&_svg]:!block"
      />
    </div>
  );
}
