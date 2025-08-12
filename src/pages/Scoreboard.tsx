import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface LeaderRow {
  user_id: string;
  username: string;
  games_played: number;
  wins: number;
  total_points: number;
  hard_slams: number;
  turns: number;
}

export default function Scoreboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [seasonName, setSeasonName] = useState<string>('Huidig seizoen');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data: season } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (season?.name) setSeasonName(season.name);

      const { data } = await supabase
        .from('leaderboard_current_season')
        .select('*')
        .order('wins', { ascending: false })
        .order('total_points', { ascending: false })
        .limit(100);

      setLeaderboard((data as any) || []);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Scoreboard — {seasonName}</h1>
          <Button variant="outline" onClick={() => navigate('/')}>Terug</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top spelers</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-muted-foreground">Nog geen resultaten.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Speler</th>
                      <th className="py-2 pr-4">Gespeeld</th>
                      <th className="py-2 pr-4">Gewonnen</th>
                      <th className="py-2 pr-4">Punten</th>
                      <th className="py-2 pr-4">Hard Slams</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, i) => (
                      <tr key={row.user_id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{i + 1}</td>
                        <td className="py-2 pr-4 font-medium">{row.username || row.user_id?.slice(0,8)}</td>
                        <td className="py-2 pr-4">{row.games_played}</td>
                        <td className="py-2 pr-4">{row.wins}</td>
                        <td className="py-2 pr-4">{row.total_points}</td>
                        <td className="py-2 pr-4">{row.hard_slams}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
