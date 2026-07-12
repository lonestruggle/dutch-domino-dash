import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, AlertCircle, Instagram } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteInfo, setInviteInfo] = useState<{ email: string; inviter: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [openRegistration, setOpenRegistration] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Check if open registration is enabled
  useEffect(() => {
    const checkOpenRegistration = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'open_registration')
        .maybeSingle();
      if (data) {
        setOpenRegistration(data.setting_value === true);
      }
    };
    checkOpenRegistration();
  }, []);

  // Check for invite code in URL and validate it
  useEffect(() => {
    const inviteCodeFromUrl = searchParams.get('invite');
    if (inviteCodeFromUrl) {
      setInviteCode(inviteCodeFromUrl);
      validateInviteCode(inviteCodeFromUrl);
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    if (user) {
      navigate('/');
    }
  }, [user, navigate, authLoading]);

  const validateInviteCode = async (code: string) => {
    if (!code) return;

    try {
      // Use server-side validation function for security
      const { data, error } = await supabase.rpc('validate_invitation_code', {
        _code: code,
        _email: null // We don't validate email during initial code validation
      });

      if (error) {
        console.error('Invitation validation error:', error);
        setInviteError(t('auth.toast.inviteValidationError'));
        return;
      }

      // Type assertion for the RPC response
      const validationResult = data as any;

      if (!validationResult.valid) {
        setInviteError(validationResult.error || t('auth.toast.invalidInvite'));
        return;
      }

      // Get inviter info for display
      const { data: inviterData } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', validationResult.invited_by)
        .single();

      setInviteInfo({
        email: validationResult.invited_email || '', // Handle empty email
        inviter: inviterData?.username || t('auth.unknown')
      });
      
      // Only pre-fill email if invitation has one
      if (validationResult.invited_email) {
        setEmail(validationResult.invited_email);
      }
      
      setInviteError('');
    } catch (error) {
      console.error('Exception validating invitation:', error);
      setInviteError(t('auth.toast.inviteValidationError'));
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting sign in with:', { email, passwordLength: password.length });
    
    if (!email || !password) {
      console.log('Sign in failed: missing email or password');
      toast({
        title: t('common.error'),
        description: t('auth.toast.fillAllFields'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let loginEmail = email;

      // Check if input is username (doesn't contain @)
      if (!email.includes('@')) {
        console.log('Input appears to be username, looking up email...');
        
        // Get email from database using the RPC function
        const { data: foundEmail, error: lookupError } = await supabase.rpc('get_email_by_username', {
          _username: email
        });

        if (lookupError || !foundEmail) {
          console.log('Username not found:', lookupError);
          toast({
            title: t('auth.toast.loginFailed'),
            description: t('auth.toast.wrongCredentials'),
            variant: "destructive",
          });
          return;
        }

        loginEmail = foundEmail;
        console.log('Found email for username:', loginEmail);
      }

      console.log('Calling supabase.auth.signInWithPassword...');
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      console.log('Sign in result:', { error });

      if (error) {
        console.log('Sign in error:', error);
        toast({
          title: t('auth.toast.loginFailed'),
          description: t('auth.toast.wrongCredentialsFull'),
          variant: "destructive",
        });
      } else {
        console.log('Sign in successful, navigating to return URL or home');
        const returnUrl = searchParams.get('returnUrl') || '/';
        toast({
          title: t('auth.toast.welcomeBack'),
          description: t('auth.toast.signInSuccess'),
        });
        navigate(returnUrl);
      }
    } catch (error) {
      console.error('Sign in exception:', error);
      toast({
        title: t('common.error'),
        description: t('auth.toast.somethingWrong'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting sign up with:', { email, username, passwordLength: password.length, inviteCode });
    
    // Check required fields - email is optional for invitations without email
    const emailRequired = inviteInfo && inviteInfo.email; // Only require email if invitation specifies one
    
    if (!password || !confirmPassword || !username || (emailRequired && !email)) {
      console.log('Sign up failed: missing required fields');
      toast({
        title: t('common.error'),
        description: emailRequired ? t('auth.toast.fillAllFields') : t('auth.toast.fillSignupFields'),
        variant: "destructive",
      });
      return;
    }

    // Uitnodigingscode is verplicht tenzij open registratie aan staat
    if (!openRegistration && !inviteCode) {
      toast({
        title: t('common.error'),
        description: t('auth.toast.inviteRequired'),
        variant: "destructive",
      });
      return;
    }

    // Valideer dat er geldige uitnodigingsinfo is (alleen als invite code is opgegeven)
    if (!openRegistration && inviteCode && !inviteInfo) {
      toast({
        title: t('common.error'),
        description: t('auth.toast.invalidInvite'),
        variant: "destructive",
      });
      return;
    }

    // Email moet overeenkomen met uitnodiging (alleen als uitnodiging een email heeft)
    if (!openRegistration && inviteInfo && inviteInfo.email && email !== inviteInfo.email) {
      toast({
        title: t('common.error'),
        description: t('auth.toast.emailMustMatchInvite'),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      console.log('Sign up failed: passwords do not match');
      toast({
        title: t('common.error'),
        description: t('auth.toast.passwordsMismatch'),
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      console.log('Sign up failed: password too short');
      toast({
        title: t('common.error'),
        description: t('auth.toast.passwordTooShort'),
        variant: "destructive",
      });
      return;
    }

    if (username.length < 3) {
      console.log('Sign up failed: username too short');
      toast({
        title: t('common.error'),
        description: t('auth.toast.usernameTooShort'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      console.log('Calling supabase.auth.signUp with redirectUrl:', redirectUrl);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: username,
            invitation_code: inviteCode || null
          }
        }
      });

      console.log('Sign up result:', { error, data });

      if (error) {
        console.log('Sign up error:', error);
        toast({
          title: t('auth.toast.signupFailed'),
          description: error.message,
          variant: "destructive",
        });
      } else {
        // If there was an invite code, mark the invitation as accepted
        if (inviteCode && data.user) {
          try {
            await supabase
              .from('invitations')
              .update({
                status: 'accepted',
                accepted_by: data.user.id,
                accepted_at: new Date().toISOString()
              })
              .eq('code', inviteCode);
          } catch (inviteError) {
            console.error('Error updating invitation:', inviteError);
            // Don't fail the whole signup for this
          }
        }

        console.log('Sign up successful');
        toast({
          title: t('auth.toast.signupSuccess'),
          description: inviteCode 
            ? t('auth.toast.signupInviteCheckEmail')
            : t('auth.toast.signupCheckEmail'),
        });
        // Clear form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setUsername('');
        setInviteCode('');
      }
    } catch (error) {
      console.error('Sign up exception:', error);
      toast({
        title: t('common.error'),
        description: t('auth.toast.somethingWrong'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-end mb-2"><LanguageSwitcher /></div>
          <CardTitle className="text-2xl font-bold">{t('auth.brand')}</CardTitle>
          <CardDescription>{t('auth.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Show invite info if present */}
          {inviteInfo && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <UserCheck className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <Trans i18nKey="auth.invitedBy" values={{ inviter: inviteInfo.inviter, email: inviteInfo.email }} components={{ 1: <strong /> }} />
              </AlertDescription>
            </Alert>
          )}
          
          {/* Show invite error if present */}
          {inviteError && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {inviteError}
              </AlertDescription>
            </Alert>
          )}
          
          <Tabs defaultValue={searchParams.get('tab') === 'signup' ? 'signup' : 'signin'} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t('auth.signIn')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.emailOrUsername')}</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder={t('auth.emailOrUsernamePh')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.signingIn')}
                    </>
                  ) : (
                    t('auth.signIn')
                  )}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Uitnodigingscode - niet nodig bij open registratie */}
                {!openRegistration && !inviteInfo && (
                  <div className="space-y-2">
                    <Label htmlFor="invite-code">{t('auth.inviteCode')}</Label>
                    <Input
                      id="invite-code"
                      type="text"
                      placeholder={t('auth.inviteCodePh')}
                      value={inviteCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setInviteCode(code);
                        if (code.length >= 8) {
                          validateInviteCode(code);
                        } else {
                          setInviteInfo(null);
                          setInviteError('');
                        }
                      }}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      {t('auth.inviteCodeHelp')}
                    </p>
                  </div>
                )}
                {openRegistration && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <AlertDescription className="text-blue-800">
                      {t('auth.openRegistrationActive')}
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="signup-username">{t('auth.username')}</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder={t('auth.usernamePh')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                 <div className="space-y-2">
                   <Label htmlFor="signup-email">
                     {t('auth.emailLabel')} {inviteInfo && inviteInfo.email ? '*' : t('auth.emailOptional')}
                   </Label>
                   <Input
                     id="signup-email"
                     type="email"
                     placeholder={inviteInfo && inviteInfo.email ? inviteInfo.email : t('auth.emailPh')}
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     disabled={!!(inviteInfo && inviteInfo.email)} // Disable if invite has specific email
                     required={!!(inviteInfo && inviteInfo.email)} // Only required if invite specifies email
                   />
                 </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('auth.password')}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t('auth.confirmPassword')}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.signingUp')}
                    </>
                  ) : (
                    t('auth.createAccount')
                  )}
                </Button>
                
                {/* Instagram Link */}
                <div className="text-center mt-4">
                  <a 
                    href="https://www.instagram.com/wegidomino"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Instagram className="h-4 w-4" />
                    {t('auth.followInstagram')}
                  </a>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;