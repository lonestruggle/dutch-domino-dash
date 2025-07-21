import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Calendar, User } from 'lucide-react';

interface InvitationStats {
  total_sent: number;
  accepted: number;
  pending: number;
  invited_by_username?: string;
  invitation_code?: string;
}

export const InvitationHistory = () => {
  const [stats, setStats] = useState<InvitationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadInvitationStats();
    }
  }, [user]);

  const loadInvitationStats = async () => {
    if (!user) return;

    try {
      // Get invitation stats for invitations sent by this user
      const { data: sentInvitations, error: sentError } = await supabase
        .from('invitations')
        .select('status')
        .eq('invited_by', user.id);

      if (sentError) throw sentError;

      // Calculate stats
      const stats: InvitationStats = {
        total_sent: sentInvitations?.length || 0,
        accepted: sentInvitations?.filter(inv => inv.status === 'accepted').length || 0,
        pending: sentInvitations?.filter(inv => inv.status === 'pending').length || 0
      };

      // Get info about who invited this user (if they were invited)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          invitation_code,
          invited_by,
          inviter:profiles!invited_by(username)
        `)
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile error:', profileError);
      } else if (profileData?.invited_by) {
        stats.invited_by_username = (profileData as any).inviter?.username || 'Onbekend';
        stats.invitation_code = profileData.invitation_code;
      }

      setStats(stats);
    } catch (error) {
      console.error('Error loading invitation stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Who invited you */}
      {stats.invited_by_username && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Uitgenodigd Door
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <span className="font-medium">{stats.invited_by_username}</span>
              {stats.invitation_code && (
                <Badge variant="secondary">
                  Code: {stats.invitation_code}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your invitation stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Jouw Uitnodigingen
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{stats.total_sent}</div>
              <div className="text-sm text-muted-foreground">Verstuurd</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
              <div className="text-sm text-muted-foreground">Geaccepteerd</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">In Afwachting</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};