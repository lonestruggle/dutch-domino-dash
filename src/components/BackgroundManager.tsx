import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCustomBackgrounds } from '@/hooks/useCustomBackgrounds';
import { Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BackgroundManagerProps {
  onBackgroundsChange?: () => void;
}

export const BackgroundManager: React.FC<BackgroundManagerProps> = ({ onBackgroundsChange }) => {
  const { backgrounds, loading, refetch } = useCustomBackgrounds();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permission_level: 'admin' as 'admin' | 'moderator' | 'user'
  });

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
      setFormData({
        name: '',
        description: '',
        permission_level: 'admin'
      });
      event.target.value = '';

      // Refresh data
      refetch();
      onBackgroundsChange?.();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fout",
        description: "Kon achtergrond niet uploaden",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (backgroundId: string) => {
    try {
      const { error } = await supabase
        .from('custom_backgrounds')
        .delete()
        .eq('id', backgroundId);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Achtergrond succesvol verwijderd",
      });

      refetch();
      onBackgroundsChange?.();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Fout",
        description: "Kon achtergrond niet verwijderen",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (backgroundId: string, currentlyActive: boolean) => {
    try {
      const { error } = await supabase
        .from('custom_backgrounds')
        .update({ is_active: !currentlyActive })
        .eq('id', backgroundId);

      if (error) throw error;

      toast({
        title: "Succes",
        description: `Achtergrond ${!currentlyActive ? 'geactiveerd' : 'gedeactiveerd'}`,
      });

      refetch();
      onBackgroundsChange?.();
    } catch (error) {
      console.error('Toggle error:', error);
      toast({
        title: "Fout",
        description: "Kon status niet wijzigen",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Nieuwe Achtergrond Uploaden
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Naam *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Bijv. Premium Hout Tafel"
            />
          </div>

          <div>
            <Label htmlFor="description">Beschrijving</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optionele beschrijving van de achtergrond"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="permission">Wie kan deze achtergrond gebruiken?</Label>
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
                <SelectItem value="moderator">Admins & Moderators</SelectItem>
                <SelectItem value="user">Iedereen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="file">Afbeelding (max 5MB) *</Label>
            <Input
              id="file"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </div>

          {isUploading && (
            <div className="text-sm text-muted-foreground">
              Bezig met uploaden...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Backgrounds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Beheer Achtergronden ({backgrounds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Laden...</div>
          ) : backgrounds.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Nog geen custom achtergronden geüpload
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {backgrounds.map((bg) => (
                <div key={bg.id} className="border rounded-lg p-4 space-y-3">
                  <div 
                    className="h-24 bg-cover bg-center rounded border"
                    style={{ backgroundImage: `url(${bg.image_url})` }}
                  />
                  
                  <div>
                    <h4 className="font-medium">{bg.name}</h4>
                    {bg.description && (
                      <p className="text-sm text-muted-foreground">{bg.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        bg.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {bg.is_active ? 'Actief' : 'Inactief'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {bg.permission_level === 'admin' ? 'Admins' : 
                         bg.permission_level === 'moderator' ? 'Moderators+' : 'Iedereen'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive(bg.id, bg.is_active)}
                    >
                      {bg.is_active ? 'Deactiveren' : 'Activeren'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(bg.id)}
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
