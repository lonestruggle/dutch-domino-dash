import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { setAppLanguage } from '@/i18n';
import { Globe } from 'lucide-react';

interface Props {
  className?: string;
  variant?: 'light' | 'dark';
}

export const LanguageSwitcher = ({ className, variant = 'dark' }: Props) => {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'nl').slice(0, 2);

  const wrapper = variant === 'light'
    ? 'border-white/30 bg-white/10'
    : 'border-input bg-background';
  const btnBase = variant === 'light'
    ? 'text-white hover:bg-white/20'
    : '';

  return (
    <div className={`inline-flex items-center gap-1 rounded-md border px-1 py-0.5 ${wrapper} ${className ?? ''}`}>
      <Globe className={`h-4 w-4 ${variant === 'light' ? 'text-white' : ''}`} aria-hidden />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={current === 'nl'}
        onClick={() => setAppLanguage('nl')}
        className={`h-7 px-2 text-xs ${current === 'nl' ? 'font-bold underline' : 'opacity-80'} ${btnBase}`}
      >
        NL
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={current === 'en'}
        onClick={() => setAppLanguage('en')}
        className={`h-7 px-2 text-xs ${current === 'en' ? 'font-bold underline' : 'opacity-80'} ${btnBase}`}
      >
        EN
      </Button>
    </div>
  );
};