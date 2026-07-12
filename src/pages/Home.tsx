import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAppSettings } from '@/hooks/useAppSettings';
import { supabase } from '@/integrations/supabase/client';
import { Play, Users, UserCircle, LogOut, LogIn, Settings, UserPlus } from 'lucide-react';
import { DominoIcon } from '@/components/DominoIcon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut, isAuthenticated } = useAuth();
  const { trackPageView } = useAnalytics();
  const { getSetting } = useAppSettings();
  const [username, setUsername] = useState<string>('');
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || 'nl').slice(0, 2);

  useEffect(() => {
    trackPageView('home');
  }, [trackPageView]);

  useEffect(() => {
    if (user) {
      fetchUsername();
    }
  }, [user]);

  const fetchUsername = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setUsername(data.username);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
    navigate('/');
  };

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: `url('/lovable-uploads/c7e39ae4-84d3-4fb2-a05f-4ea95a7010d7.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <Helmet>
        <html lang={lang} />
        <title>{t('home.metaTitle')}</title>
        <meta name="description" content={t('home.metaDescription')} />
        <meta property="og:title" content={t('home.metaTitle')} />
        <meta property="og:description" content={t('home.metaDescription')} />
      </Helmet>
      {/* Dark overlay for better readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      
      {/* All content with relative positioning */}
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-white/20 bg-black/20 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <DominoIcon className="h-8 w-8 text-white" size={32} />
                <span className="font-bold text-xl text-white">{t('home.brand')}</span>
              </div>
              
              <div className="flex w-full sm:w-auto flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <LanguageSwitcher variant="light" className="self-end sm:self-auto" />
                {isAuthenticated && user ? (
                  <>
                     <div className="flex items-center gap-2 text-white">
                       <UserCircle className="h-5 w-5" />
                       <span className="text-sm font-medium">{t('nav.welcome', { name: username || user.email })}</span>
                     </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/profile')} className="w-full sm:w-auto border-white/30 bg-white/10 text-white hover:bg-white/20">
                      <UserCircle className="mr-2 h-4 w-4" />
                      {t('nav.profile')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full sm:w-auto border-white/30 bg-white/10 text-white hover:bg-white/20">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('nav.logout')}
                    </Button>
                  </>
                ) : (
                  <div className="flex w-full sm:w-auto flex-col gap-2 sm:flex-row">
                    <Button onClick={() => navigate('/auth')} className="w-full sm:w-auto bg-primary hover:bg-primary/80 text-white">
                      <LogIn className="mr-2 h-4 w-4" />
                      {t('nav.login')}
                    </Button>
                    <Button 
                      onClick={() => navigate('/auth?tab=signup')} 
                      variant="outline" 
                      className="w-full sm:w-auto border-white/30 bg-white/10 text-white hover:bg-white/20"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {t('nav.register')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <DominoIcon className="h-12 w-12 text-white" size={48} />
                <h1 className="text-4xl font-bold text-white drop-shadow-2xl">{t('home.title')}</h1>
              </div>
              <p className="text-lg text-white/90 drop-shadow-lg">
                {isAuthenticated ? t('home.subtitleAuthed') : t('home.subtitleGuest')}
              </p>
            </div>

            <div className={`grid grid-cols-1 ${getSetting('single_player_enabled') === true ? 'md:grid-cols-2' : ''} gap-6`}>
              {getSetting('single_player_enabled') === true && (
                <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-md border-white/20">
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-4 p-3 bg-white/20 rounded-full w-fit">
                      <Play className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-xl text-white">{t('home.singlePlayer')}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-4">
                    <p className="text-white/80">
                      {t('home.singlePlayerDesc')}
                    </p>
                    <Button 
                      onClick={() => navigate('/single-player')} 
                      className="w-full bg-gray-500 hover:bg-gray-500 text-white cursor-not-allowed"
                      size="lg"
                      disabled
                    >
                      {t('home.singlePlayerDisabled')}
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-white/20 rounded-full w-fit">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl text-white">{t('home.multiplayer')}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-white/80">
                    {t('home.multiplayerDesc')}
                  </p>
                  <div className="grid gap-2">
                    <Button 
                      onClick={() => navigate('/lobbies')} 
                      className="w-full bg-primary hover:bg-primary/80 text-white"
                      size="lg"
                    >
                      {t('home.joinMultiplayer')}
                    </Button>
                    <Button 
                      onClick={() => navigate('/scoreboard')} 
                      variant="outline"
                      className="w-full border-white/30 bg-white/10 text-white hover:bg-white/20"
                      size="lg"
                    >
                      {t('home.scoreboard')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-white/60">
                {t('home.footer')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}