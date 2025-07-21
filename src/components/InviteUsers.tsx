import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, Copy, Check, Link, Share } from 'lucide-react';

interface Invitation {
  id: string;
  code: string;
  invited_email: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
}

export const InviteUsers = () => {
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const createInvitation = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invitations')
        .insert([{
          invited_email: '', // No email required for link sharing
          invited_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      const inviteUrl = `${window.location.origin}/auth?invite=${data.code}`;
      await navigator.clipboard.writeText(inviteUrl);
      
      toast({
        title: "Uitnodigingslink aangemaakt!",
        description: "De link is gekopieerd naar je klembord. Deel deze via WhatsApp of andere apps!"
      });

      loadInvitations();
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast({
        title: "Fout",
        description: "Kon uitnodigingslink niet aanmaken",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('invited_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading invitations:', error);
    } else {
      setInvitations(data || []);
    }
  };

  const copyInviteLink = async (code: string) => {
    const inviteUrl = `${window.location.origin}/auth?invite=${code}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({
        title: "Link gekopieerd!",
        description: "Uitnodigingslink is naar klembord gekopieerd."
      });
    } catch (error) {
      toast({
        title: "Fout",
        description: "Kon link niet kopiëren",
        variant: "destructive"
      });
    }
  };

  // Load invitations on mount
  useState(() => {
    if (user) {
      loadInvitations();
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-green-600';
      case 'expired': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted': return 'Geaccepteerd';
      case 'expired': return 'Verlopen';
      default: return 'In afwachting';
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Invitation Link Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share className="h-5 w-5" />
            Uitnodigingslink Maken
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Maak een uitnodigingslink die je kunt delen via WhatsApp, Telegram of andere apps.
          </p>
          <Button 
            onClick={createInvitation}
            disabled={loading}
            className="w-full"
          >
            <Link className="h-4 w-4 mr-2" />
            {loading ? 'Link maken...' : 'Nieuwe Uitnodigingslink Maken'}
          </Button>
        </CardContent>
      </Card>

      {/* Invitation History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mijn Uitnodigingen ({invitations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Je hebt nog geen uitnodigingen verstuurd.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">Uitnodigingslink #{invitation.code}</p>
                    <p className="text-sm text-muted-foreground">
                      Status: 
                      <span className={`ml-1 ${getStatusColor(invitation.status)}`}>
                        {getStatusText(invitation.status)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Aangemaakt: {new Date(invitation.created_at).toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyInviteLink(invitation.code)}
                      disabled={invitation.status === 'expired'}
                    >
                      {copiedCode === invitation.code ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};