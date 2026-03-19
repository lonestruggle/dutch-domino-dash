import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Upload, UserPlus } from 'lucide-react';

interface UserOption {
  user_id: string;
  username: string;
}

interface GloveSkin {
  id: string;
  name: string;
  image_url: string;
  is_active: boolean;
  overlay_offset_x: number;
  overlay_offset_y: number;
  overlay_scale: number;
  overlay_rotation: number;
}

interface UserGloveAssignment {
  id: string;
  user_id: string;
  skin_id: string;
  is_enabled: boolean;
  source: string;
}

interface GloveSkinManagerProps {
  users: UserOption[];
  adminUserId?: string;
}

const fallbackSkinName = (fileName: string) => {
  const base = fileName.replace(/\.[^/.]+$/, '').trim();
  return base.length > 0 ? base : `Skin ${Date.now()}`;
};

const BASE_GLOVE_IMAGE = '/glove-hand.svg';

export function GloveSkinManager({ users, adminUserId }: GloveSkinManagerProps) {
  const { toast } = useToast();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [skinName, setSkinName] = useState('');
  const [skins, setSkins] = useState<GloveSkin[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedSkinId, setSelectedSkinId] = useState<string>('');
  const [userAssignments, setUserAssignments] = useState<UserGloveAssignment[]>([]);
  const [selectedUserCurrentSkinId, setSelectedUserCurrentSkinId] = useState<string | null>(null);
  const [skinTransformDrafts, setSkinTransformDrafts] = useState<
    Record<string, { x: string; y: string; scale: string; rotation: string }>
  >({});

  const availableSkinOptions = useMemo(
    () => skins.filter((skin) => skin.is_active),
    [skins]
  );

  const loadSkins = async () => {
    const { data, error } = await supabase
      .from('glove_skins')
      .select('id, name, image_url, is_active, overlay_offset_x, overlay_offset_y, overlay_scale, overlay_rotation')
      .order('created_at', { ascending: true });

    if (error) throw error;
    const nextSkins = (data || []) as GloveSkin[];
    setSkins(nextSkins);
    setSkinTransformDrafts((prev) => {
      const next = { ...prev };
      nextSkins.forEach((skin) => {
        if (!next[skin.id]) {
          next[skin.id] = {
            x: String(skin.overlay_offset_x ?? 0),
            y: String(skin.overlay_offset_y ?? 0),
            scale: String(skin.overlay_scale ?? 1),
            rotation: String(skin.overlay_rotation ?? 0),
          };
        }
      });
      return next;
    });
  };

  const loadAssignmentsForUser = async (userId: string) => {
    if (!userId) {
      setUserAssignments([]);
      setSelectedUserCurrentSkinId(null);
      return;
    }

    const [{ data: assignmentRows, error: assignmentError }, { data: profileRow, error: profileError }] = await Promise.all([
      supabase
        .from('user_glove_skins')
        .select('id, user_id, skin_id, is_enabled, source')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('selected_glove_skin_id')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (assignmentError) throw assignmentError;
    if (profileError) throw profileError;

    setUserAssignments((assignmentRows || []) as UserGloveAssignment[]);
    setSelectedUserCurrentSkinId(profileRow?.selected_glove_skin_id || null);
  };

  const reloadAll = async () => {
    setLoading(true);
    try {
      await loadSkins();
      if (selectedUserId) {
        await loadAssignmentsForUser(selectedUserId);
      }
    } catch (error) {
      console.error('Failed to load glove skin manager data:', error);
      toast({
        title: 'Fout',
        description: 'Kon handschoen skins niet laden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    void loadAssignmentsForUser(selectedUserId).catch((error) => {
      console.error('Failed to load user glove assignments:', error);
      toast({
        title: 'Fout',
        description: 'Kon user skin-toewijzingen niet laden.',
        variant: 'destructive',
      });
    });
  }, [selectedUserId, toast]);

  const handleUploadSkin = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ongeldig bestand',
        description: 'Upload een afbeeldingsbestand.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    const cleanedName = skinName.trim() || fallbackSkinName(file.name);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `glove-skins/${adminUserId || 'admin'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('table-backgrounds')
        .upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('table-backgrounds').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('glove_skins').insert({
        name: cleanedName,
        image_url: publicUrl,
        is_active: true,
        created_by: adminUserId || null,
        overlay_offset_x: 0,
        overlay_offset_y: 0,
        overlay_scale: 1,
        overlay_rotation: 0,
      });
      if (insertError) throw insertError;

      toast({
        title: 'Skin geupload',
        description: `${cleanedName} is toegevoegd aan de skin-bibliotheek.`,
      });

      setSkinName('');
      await reloadAll();
    } catch (error) {
      console.error('Failed to upload glove skin:', error);
      toast({
        title: 'Upload mislukt',
        description: 'Kon skin niet uploaden of opslaan.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSkinTransformDraftChange = (
    skinId: string,
    field: 'x' | 'y' | 'scale' | 'rotation',
    value: string
  ) => {
    setSkinTransformDrafts((prev) => ({
      ...prev,
      [skinId]: {
        x: prev[skinId]?.x ?? '0',
        y: prev[skinId]?.y ?? '0',
        scale: prev[skinId]?.scale ?? '1',
        rotation: prev[skinId]?.rotation ?? '0',
        [field]: value,
      },
    }));
  };

  const handleSaveSkinTransform = async (skin: GloveSkin) => {
    const draft = skinTransformDrafts[skin.id];
    if (!draft) return;

    const parsedX = Number(draft.x);
    const parsedY = Number(draft.y);
    const parsedScale = Number(draft.scale);
    const parsedRotation = Number(draft.rotation);

    const overlay_offset_x = Number.isFinite(parsedX) ? Math.max(-100, Math.min(100, parsedX)) : 0;
    const overlay_offset_y = Number.isFinite(parsedY) ? Math.max(-100, Math.min(100, parsedY)) : 0;
    const overlay_scale = Number.isFinite(parsedScale) ? Math.max(0, Math.min(4, parsedScale)) : 1;
    const overlay_rotation = Number.isFinite(parsedRotation) ? Math.max(-180, Math.min(180, parsedRotation)) : 0;

    try {
      const { error } = await supabase
        .from('glove_skins')
        .update({
          overlay_offset_x,
          overlay_offset_y,
          overlay_scale,
          overlay_rotation,
        })
        .eq('id', skin.id);
      if (error) throw error;

      toast({
        title: 'Skin uitlijning opgeslagen',
        description: `${skin.name} overlay is bijgewerkt.`,
      });

      await loadSkins();
    } catch (error) {
      console.error('Failed to save skin overlay transform:', error);
      toast({
        title: 'Opslaan mislukt',
        description: 'Kon skin uitlijning niet opslaan.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSkinActive = async (skin: GloveSkin) => {
    try {
      const { error } = await supabase
        .from('glove_skins')
        .update({ is_active: !skin.is_active })
        .eq('id', skin.id);
      if (error) throw error;

      toast({
        title: 'Skin bijgewerkt',
        description: `${skin.name} is nu ${!skin.is_active ? 'actief' : 'inactief'}.`,
      });
      await reloadAll();
    } catch (error) {
      console.error('Failed to toggle glove skin active state:', error);
      toast({
        title: 'Opslaan mislukt',
        description: 'Kon skin status niet aanpassen.',
        variant: 'destructive',
      });
    }
  };

  const handleAssignSkin = async () => {
    if (!selectedUserId || !selectedSkinId) return;

    try {
      const { error } = await supabase.from('user_glove_skins').upsert(
        {
          user_id: selectedUserId,
          skin_id: selectedSkinId,
          source: 'assigned',
          is_enabled: true,
          created_by: adminUserId || null,
        },
        { onConflict: 'user_id,skin_id' }
      );
      if (error) throw error;

      toast({
        title: 'Skin toegewezen',
        description: 'Speler kan deze skin nu kiezen in profiel.',
      });
      await loadAssignmentsForUser(selectedUserId);
    } catch (error) {
      console.error('Failed to assign glove skin:', error);
      toast({
        title: 'Toewijzen mislukt',
        description: 'Kon skin niet toewijzen.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleUserSkin = async (assignment: UserGloveAssignment) => {
    try {
      const nextEnabled = !assignment.is_enabled;
      const { error } = await supabase
        .from('user_glove_skins')
        .update({ is_enabled: nextEnabled })
        .eq('id', assignment.id);
      if (error) throw error;

      if (!nextEnabled && selectedUserCurrentSkinId === assignment.skin_id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ selected_glove_skin_id: null })
          .eq('user_id', assignment.user_id);
        if (profileError) throw profileError;
      }

      toast({
        title: 'Toewijzing bijgewerkt',
        description: `Skin is nu ${nextEnabled ? 'ingeschakeld' : 'uitgeschakeld'} voor deze speler.`,
      });
      await loadAssignmentsForUser(assignment.user_id);
    } catch (error) {
      console.error('Failed to toggle user glove skin assignment:', error);
      toast({
        title: 'Opslaan mislukt',
        description: 'Kon user skin-toewijzing niet aanpassen.',
        variant: 'destructive',
      });
    }
  };

  const handleSetSelectedSkinForUser = async (userId: string, skinId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ selected_glove_skin_id: skinId })
        .eq('user_id', userId);
      if (error) throw error;

      toast({
        title: 'Actieve skin aangepast',
        description: 'Deze skin staat nu actief op het profiel van de speler.',
      });
      await loadAssignmentsForUser(userId);
    } catch (error) {
      console.error('Failed to set selected glove skin for user:', error);
      toast({
        title: 'Bijwerken mislukt',
        description: 'Kon actieve skin niet instellen.',
        variant: 'destructive',
      });
    }
  };

  const skinById = useMemo(
    () => skins.reduce((acc, skin) => ({ ...acc, [skin.id]: skin }), {} as Record<string, GloveSkin>),
    [skins]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Handschoen skins beheren
          </CardTitle>
          <CardDescription>
            Upload nieuwe skins, schakel skins globaal aan/uit en wijs skins toe aan spelers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="space-y-2">
              <Label>Skin naam (optioneel)</Label>
              <Input
                value={skinName}
                onChange={(e) => setSkinName(e.target.value)}
                placeholder="Bijv. Gouden Handschoen"
              />
            </div>
            <div className="flex items-end">
              <Input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadSkin}
              />
              <Button
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploading}
                className="w-full md:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Uploaden...' : 'Upload skin'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skin bibliotheek</CardTitle>
          <CardDescription>Globale beschikbaarheid per skin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Laden...</p>
          ) : skins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen skins toegevoegd.</p>
          ) : (
            skins.map((skin) => (
              <div key={skin.id} className="rounded border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img src={skin.image_url} alt={skin.name} className="h-10 w-10 rounded object-cover border" />
                    <div>
                      <div className="font-medium">{skin.name}</div>
                      <Badge variant={skin.is_active ? 'default' : 'secondary'}>
                        {skin.is_active ? 'Actief' : 'Inactief'}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleToggleSkinActive(skin)}>
                    {skin.is_active ? 'Deactiveren' : 'Activeren'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">X offset (%)</Label>
                    <Input
                      type="number"
                      value={skinTransformDrafts[skin.id]?.x ?? String(skin.overlay_offset_x)}
                      onChange={(e) => handleSkinTransformDraftChange(skin.id, 'x', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Y offset (%)</Label>
                    <Input
                      type="number"
                      value={skinTransformDrafts[skin.id]?.y ?? String(skin.overlay_offset_y)}
                      onChange={(e) => handleSkinTransformDraftChange(skin.id, 'y', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Scale</Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={skinTransformDrafts[skin.id]?.scale ?? String(skin.overlay_scale)}
                      onChange={(e) => handleSkinTransformDraftChange(skin.id, 'scale', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rotatie (°)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={skinTransformDrafts[skin.id]?.rotation ?? String(skin.overlay_rotation)}
                      onChange={(e) => handleSkinTransformDraftChange(skin.id, 'rotation', e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" size="sm" onClick={() => handleSaveSkinTransform(skin)}>
                      Positie opslaan
                    </Button>
                  </div>
                </div>

                <div className="rounded border bg-muted/20 p-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Preview (basis-handschoen + skin overlay)
                  </p>
                  <div className="relative h-20 w-20 rounded-full bg-black/35 flex items-center justify-center overflow-hidden">
                    <img src={BASE_GLOVE_IMAGE} alt="Base glove" className="domino-hand-image fixed-glove-image" />
                    {skin.image_url !== BASE_GLOVE_IMAGE && (
                      <span className="domino-hand-skin-mask">
                        <img
                          src={skin.image_url}
                          alt={`${skin.name} overlay`}
                          className="domino-hand-skin-overlay"
                          style={{
                            '--skin-overlay-x': `${Number(skinTransformDrafts[skin.id]?.x ?? skin.overlay_offset_x)}%`,
                            '--skin-overlay-y': `${Number(skinTransformDrafts[skin.id]?.y ?? skin.overlay_offset_y)}%`,
                            '--skin-overlay-scale': Number(skinTransformDrafts[skin.id]?.scale ?? skin.overlay_scale).toString(),
                            '--skin-overlay-rotation': `${Number(skinTransformDrafts[skin.id]?.rotation ?? skin.overlay_rotation)}deg`,
                          } as CSSProperties}
                        />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Toewijzing per speler
          </CardTitle>
          <CardDescription>
            Wijs skins toe (of schakel uit) per speler. Speler kiest daarna in profiel uit toegewezen skins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Kies speler" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSkinId} onValueChange={setSelectedSkinId}>
              <SelectTrigger>
                <SelectValue placeholder="Kies skin" />
              </SelectTrigger>
              <SelectContent>
                {availableSkinOptions.map((skin) => (
                  <SelectItem key={skin.id} value={skin.id}>
                    {skin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleAssignSkin} disabled={!selectedUserId || !selectedSkinId}>
              Toewijzen
            </Button>
          </div>

          {!selectedUserId ? (
            <p className="text-sm text-muted-foreground">Selecteer een speler om skins te beheren.</p>
          ) : userAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Deze speler heeft nog geen toegewezen skins.</p>
          ) : (
            <div className="space-y-2">
              {userAssignments.map((assignment) => {
                const skin = skinById[assignment.skin_id];
                if (!skin) return null;
                const isSelected = selectedUserCurrentSkinId === assignment.skin_id;
                return (
                  <div key={assignment.id} className="flex items-center justify-between gap-3 rounded border p-3">
                    <div className="flex items-center gap-3">
                      <img src={skin.image_url} alt={skin.name} className="h-9 w-9 rounded object-cover border" />
                      <div>
                        <div className="font-medium">{skin.name}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant={assignment.is_enabled ? 'default' : 'secondary'}>
                            {assignment.is_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {isSelected && <Badge variant="outline">Actieve profielskin</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleToggleUserSkin(assignment)}>
                        {assignment.is_enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!assignment.is_enabled}
                        onClick={() => handleSetSelectedSkinForUser(assignment.user_id, assignment.skin_id)}
                      >
                        Zet actief
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
