import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Prof = { user_id: string; username: string; coins: number; win_streak: number };

export function CoinsManager() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [target, setTarget] = useState<string>('all');
  const [amount, setAmount] = useState(1000);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('profiles').select('user_id, username, coins, win_streak').order('coins', { ascending: false });
    setProfiles((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const run = async (mode: 'set' | 'add', amt: number) => {
    if (target === 'all' && !confirm(`Weet je zeker dat je dit voor ALLE spelers wilt doen?`)) return;
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)('admin_adjust_coins', {
      _target_user: target === 'all' ? null : target, _amount: amt, _mode: mode,
    });
    setBusy(false);
    if (error) toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    else { toast({ title: `Coins bijgewerkt (${data} speler(s))` }); load(); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coins beheer</CardTitle>
        <CardDescription>
          Resetten, geven of afpakken. Regels: dagbonus 100 · winnaar krijgt de ingestelde coins per potje (max 10) · winreeks 3 = +25, 5 = +50, 10 = +100.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Speler</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle spelers</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.username} ({p.coins})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Aantal coins</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => run('set', amount)}>Zet op {amount}</Button>
          <Button disabled={busy} variant="secondary" onClick={() => run('add', amount)}>Geef +{amount}</Button>
          <Button disabled={busy} variant="destructive" onClick={() => run('add', -amount)}>Pak af -{amount}</Button>
        </div>
        <div className="max-h-72 overflow-auto rounded border text-sm">
          <table className="w-full">
            <thead><tr className="text-left"><th className="p-2">Speler</th><th className="p-2">Coins</th><th className="p-2">Winreeks</th></tr></thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.user_id} className="border-t"><td className="p-2">{p.username}</td><td className="p-2">{p.coins}</td><td className="p-2">{p.win_streak}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
