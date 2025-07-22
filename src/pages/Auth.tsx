import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, AlertCircle } from 'lucide-react';
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

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
        setInviteError('Fout bij valideren uitnodigingscode');
        return;
      }

      // Type assertion for the RPC response
      const validationResult = data as any;

      if (!validationResult.valid) {
        setInviteError(validationResult.error || 'Ongeldige uitnodigingscode');
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
        inviter: inviterData?.username || 'Onbekend'
      });
      
      // Only pre-fill email if invitation has one
      if (validationResult.invited_email) {
        setEmail(validationResult.invited_email);
      }
      
      setInviteError('');
    } catch (error) {
      console.error('Exception validating invitation:', error);
      setInviteError('Fout bij valideren uitnodigingscode');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting sign in with:', { email, passwordLength: password.length });
    
    if (!email || !password) {
      console.log('Sign in failed: missing email or password');
      toast({
        title: "Error",
        description: "Vul alle velden in",
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
            title: "Inloggen mislukt",
            description: "Gebruikersnaam of wachtwoord is onjuist",
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
          title: "Inloggen mislukt",
          description: "Email/gebruikersnaam of wachtwoord is onjuist",
          variant: "destructive",
        });
      } else {
        console.log('Sign in successful, navigating to return URL or home');
        const returnUrl = searchParams.get('returnUrl') || '/';
        toast({
          title: "Welkom terug!",
          description: "Je bent succesvol ingelogd",
        });
        navigate(returnUrl);
      }
    } catch (error) {
      console.error('Sign in exception:', error);
      toast({
        title: "Error",
        description: "Er is iets misgegaan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting sign up with:', { email, username, passwordLength: password.length, inviteCode });
    
    if (!email || !password || !confirmPassword || !username) {
      console.log('Sign up failed: missing fields');
      toast({
        title: "Error",
        description: "Vul alle velden in",
        variant: "destructive",
      });
      return;
    }

    // Uitnodigingscode is verplicht
    if (!inviteCode) {
      toast({
        title: "Error",
        description: "Uitnodigingscode is verplicht om te registreren",
        variant: "destructive",
      });
      return;
    }

    // Valideer dat er geldige uitnodigingsinfo is
    if (!inviteInfo) {
      toast({
        title: "Error",
        description: "Ongeldige uitnodigingscode",
        variant: "destructive",
      });
      return;
    }

    // Email moet overeenkomen met uitnodiging (alleen als uitnodiging een email heeft)
    if (inviteInfo.email && email !== inviteInfo.email) {
      toast({
        title: "Error",
        description: "Email moet overeenkomen met uitnodiging",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      console.log('Sign up failed: passwords do not match');
      toast({
        title: "Error",
        description: "Wachtwoorden komen niet overeen",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      console.log('Sign up failed: password too short');
      toast({
        title: "Error",
        description: "Wachtwoord moet minstens 6 karakters zijn",
        variant: "destructive",
      });
      return;
    }

    if (username.length < 3) {
      console.log('Sign up failed: username too short');
      toast({
        title: "Error",
        description: "Gebruikersnaam moet minstens 3 karakters zijn",
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
          title: "Registratie mislukt",
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
          title: "Registratie succesvol!",
          description: inviteCode 
            ? "Account aangemaakt via uitnodiging! Controleer je email om te bevestigen."
            : "Controleer je email om je account te bevestigen",
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
        title: "Error",
        description: "Er is iets misgegaan",
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
          <CardTitle className="text-2xl font-bold">Wegi Domino</CardTitle>
          <CardDescription>
            Log in of registreer je via uitnodiging om te spelen
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Show invite info if present */}
          {inviteInfo && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <UserCheck className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Je bent uitgenodigd door <strong>{inviteInfo.inviter}</strong> voor {inviteInfo.email}
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
          
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Inloggen</TabsTrigger>
              <TabsTrigger value="signup">Registreren</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email of Gebruikersnaam</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="je@email.com of gebruikersnaam"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Wachtwoord</Label>
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
                      Inloggen...
                    </>
                  ) : (
                    'Inloggen'
                  )}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Uitnodigingscode is altijd verplicht */}
                {!inviteInfo && (
                  <div className="space-y-2">
                    <Label htmlFor="invite-code">Uitnodigingscode *</Label>
                    <Input
                      id="invite-code"
                      type="text"
                      placeholder="Voer je uitnodigingscode in"
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
                      Je hebt een uitnodigingscode nodig om te registreren
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Gebruikersnaam</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="JeNaam"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="je@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!!inviteInfo} // Disable if invite is valid
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Wachtwoord</Label>
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
                  <Label htmlFor="confirm-password">Bevestig Wachtwoord</Label>
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
                      Registreren...
                    </>
                  ) : (
                    'Account Aanmaken'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;