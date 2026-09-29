import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, Copy, Check, Link, Share, Trash2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user } = useAuth();
  const { toast } = useToast();

  // Update current time every minute for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

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
        title: t('invite.linkCreated'),
        description: t('invite.linkCreatedDesc')
      });

      loadInvitations();
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast({
        title: t('common.error'),
        description: t('invite.createFailed'),
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
        title: t('invite.linkCopied'),
        description: t('invite.linkCopiedDesc')
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('invite.copyFailed'),
        variant: "destructive"
      });
    }
  };

  const deleteInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: t('invite.deleted'),
        description: t('invite.deletedDesc')
      });

      loadInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast({
        title: t('common.error'),
        description: t('invite.deleteFailed'),
        variant: "destructive"
      });
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = currentTime.getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) {
      return t('invite.expired');
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return t('invite.hoursMinutesLeft', { hours, minutes });
    } else {
      return t('invite.minutesLeft', { minutes });
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt).getTime() <= currentTime.getTime();
  };

  // Load invitations on mount
  useEffect(() => {
    if (user) {
      loadInvitations();
    }
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-green-600';
      case 'expired': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted': return t('invite.accepted');
      case 'expired': return t('invite.expired');
      default: return t('invite.pending');
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Invitation Link Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share className="h-5 w-5" />
            {t('invite.createLink')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t('invite.createLinkDesc')}
          </p>
          <Button 
            onClick={createInvitation}
            disabled={loading}
            className="w-full"
          >
            <Link className="h-4 w-4 mr-2" />
            {loading ? t('invite.creatingLink') : t('invite.createNewLink')}
          </Button>
        </CardContent>
      </Card>

      {/* Invitation History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('invite.myInvitations', { count: invitations.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('invite.noneSent')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                 >
                   <div className="flex-1">
                      <p className="font-medium">{t('invite.linkNumber', { code: invitation.code })}</p>
                     <div className="flex items-center gap-4 text-sm text-muted-foreground">
                       <span>
                          {t('invite.status')}:{' '}
                         <span className={`ml-1 ${getStatusColor(invitation.status)}`}>
                           {getStatusText(invitation.status)}
                         </span>
                       </span>
                       <span className="flex items-center gap-1">
                         <Clock className="h-3 w-3" />
                         {isExpired(invitation.expires_at) ? (
                            <span className="text-red-600">{t('invite.expired')}</span>
                         ) : (
                           <span className="text-orange-600">{getTimeRemaining(invitation.expires_at)}</span>
                         )}
                       </span>
                     </div>
                     <p className="text-xs text-muted-foreground">
                        {t('invite.created')}: {new Date(invitation.created_at).toLocaleDateString(undefined, {
                         day: 'numeric',
                         month: 'short',
                         hour: '2-digit',
                         minute: '2-digit'
                       })}
                     </p>
                   </div>
                   <div className="flex gap-2">
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={() => copyInviteLink(invitation.code)}
                       disabled={isExpired(invitation.expires_at) || invitation.status === 'accepted'}
                        aria-label={t('invite.copyLink')}
                     >
                       {copiedCode === invitation.code ? (
                         <Check className="h-4 w-4" />
                       ) : (
                         <Copy className="h-4 w-4" />
                       )}
                     </Button>
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={() => deleteInvitation(invitation.id)}
                       className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        aria-label={t('invite.deleteInvitation')}
                     >
                       <Trash2 className="h-4 w-4" />
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