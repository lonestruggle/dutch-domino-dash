import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCustomBackgrounds } from '@/hooks/useCustomBackgrounds';
import { Trash2, Upload, Image as ImageIcon, Users, Plus, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BackgroundManagerProps {
  onBackgroundsChange?: () => void;
}

interface UserProfile {
  user_id: string;
  username: string;
}

interface BackgroundPermission {
  user_id: string;
  username: string;
  can_use: boolean;
}

export const BackgroundManager: React.FC<BackgroundManagerProps> = ({ onBackgroundsChange }) => {
  const { backgrounds, loading, refetch } = useCustomBackgrounds();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [backgroundPermissions, setBackgroundPermissions] = useState<BackgroundPermission[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permission_level: 'admin' as 'admin' | 'moderator' | 'user'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username')
        .order('username');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchBackgroundPermissions = async (backgroundId: string) => {
    try {
      const { data, error } = await supabase
        .from('background_user_permissions')
        .select(`
          user_id,
          can_use,
          profiles!inner(username)
        `)
        .eq('background_id', backgroundId);

      if (error) throw error;

      // Combine with all users to show who doesn't have explicit permissions
      const permissionsMap = new Map(
        data?.map(p => [p.user_id, { ...p, username: (p.profiles as any).username }]) || []
      );

      const allPermissions = users.map(user => ({
        user_id: user.user_id,
        username: user.username,
        can_use: permissionsMap.get(user.user_id)?.can_use ?? true // Default to true if no explicit permission
      }));

      setBackgroundPermissions(allPermissions);
    } catch (error) {
      console.error('Error fetching background permissions:', error);
      toast({
        title: "Fout",
        description: "Kon gebruikers permissions niet laden",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Fout",
        description: "Selecteer alleen afbeeldingsbestanden",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Fout", 
        description: "Bestand mag maximaal 5MB zijn",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Fout",
        description: "Vul een naam in voor de achtergrond",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('table-backgrounds')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('table-backgrounds')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from('custom_backgrounds')
        .insert({
          name: formData.name,
          description: formData.description || null,
          image_url: publicUrl,
          permission_level: formData.permission_level,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id!
        });

      if (dbError) throw dbError;

      toast({
        title: "Succes",
        description: "Achtergrond succesvol geüpload",
      });

      // Reset form
      setFormData({ name: '', description: '', permission_level: 'admin' });
      
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }

      // Refresh backgrounds
      refetch();
      onBackgroundsChange?.();

    } catch (error) {
      console.error('Error uploading background:', error);
      toast({
        title: "Fout",
        description: "Kon achtergrond niet uploaden",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteBackground = async (id: string, imageUrl: string) => {
    try {
      // Extract filename from URL for storage deletion
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];

      // Delete file from storage
      await supabase.storage
        .from('table-backgrounds')
        .remove([fileName]);

      // Delete background record (permissions will be deleted via CASCADE)
      const { error } = await supabase
        .from('custom_backgrounds')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Achtergrond verwijderd",
      });

      refetch();
      onBackgroundsChange?.();
    } catch (error) {
      console.error('Error deleting background:', error);
      toast({
        title: "Fout",
        description: "Kon achtergrond niet verwijderen",
        variant: "destructive",
      });
    }
  };

  const handlePermissionChange = async (userId: string, canUse: boolean) => {
    if (!selectedBackground) return;

    try {
      // First try to update existing permission
      const { data: existing, error: fetchError } = await supabase
        .from('background_user_permissions')
        .select('id')
        .eq('user_id', userId)
        .eq('background_id', selectedBackground)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        // Update existing permission
        const { error: updateError } = await supabase
          .from('background_user_permissions')
          .update({ can_use: canUse })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Create new permission
        const { error: insertError } = await supabase
          .from('background_user_permissions')
          .insert({
            user_id: userId,
            background_id: selectedBackground,
            can_use: canUse,
            created_by: (await supabase.auth.getUser()).data.user?.id
          });

        if (insertError) throw insertError;
      }

      // Update local state
      setBackgroundPermissions(prev => 
        prev.map(p => 
          p.user_id === userId 
            ? { ...p, can_use: canUse }
            : p
        )
      );

      toast({
        title: "Succes",
        description: `Gebruiker kan nu ${canUse ? 'wel' : 'niet'} deze achtergrond gebruiken`,
      });

    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: "Fout",
        description: "Kon permission niet bijwerken",
        variant: "destructive",
      });
    }
  };

  const openPermissionsDialog = (backgroundId: string) => {
    setSelectedBackground(backgroundId);
    fetchBackgroundPermissions(backgroundId);
  };

  if (loading) {
    return <div>Laden...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Upload New Background */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nieuwe Frame Achtergrond Uploaden
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Naam *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="bijv. Premium Hout"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschrijving</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optionele beschrijving van de achtergrond"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permission_level">Wie kan deze achtergrond gebruiken?</Label>
            <Select 
              value={formData.permission_level} 
              onValueChange={(value: 'admin' | 'moderator' | 'user') => 
                setFormData(prev => ({ ...prev, permission_level: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Alleen Admins</SelectItem>
                <SelectItem value="moderator">Moderators</SelectItem>
                <SelectItem value="user">Iedereen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Afbeelding (max 5MB) *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <Button 
                type="submit" 
                disabled={isUploading || !formData.name.trim()}
                className="whitespace-nowrap"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploaden...' : 'Upload'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manage Backgrounds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Beheer Frame Achtergronden ({backgrounds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {backgrounds.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">
                Nog geen achtergronden geüpload
              </p>
            ) : (
              backgrounds.map((background) => (
                <Card key={background.id} className="overflow-hidden">
                  <div className="aspect-video relative">
                    <img
                      src={background.image_url}
                      alt={background.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant={background.is_active ? "default" : "secondary"}>
                        {background.is_active ? 'Actief' : 'Inactief'}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium truncate">{background.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {background.description}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {background.permission_level}
                      </Badge>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPermissionsDialog(background.id)}
                            className="flex-1"
                          >
                            <Users className="h-4 w-4 mr-1" />
                            Gebruikers
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-96 overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Gebruikers Permissions</DialogTitle>
                            <DialogDescription>
                              Beheer wie deze achtergrond kan gebruiken
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3">
                            {backgroundPermissions.map((permission) => (
                              <div key={permission.user_id} className="flex items-center justify-between">
                                <span className="text-sm">{permission.username}</span>
                                <Checkbox
                                  checked={permission.can_use}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(permission.user_id, checked as boolean)
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteBackground(background.id, background.image_url)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};