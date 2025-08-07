import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Upload, Image as ImageIcon, Check, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TableBackground {
  id: string;
  name: string;
  background_url: string;
  is_active: boolean;
  created_at: string;
}

interface TableBackgroundManagerProps {
  onBackgroundsChange?: () => void;
}

export const TableBackgroundManager: React.FC<TableBackgroundManagerProps> = ({ onBackgroundsChange }) => {
  const { toast } = useToast();
  const [backgrounds, setBackgrounds] = useState<TableBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const fetchBackgrounds = async () => {
    try {
      const { data, error } = await supabase
        .from('table_background_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBackgrounds(data || []);
    } catch (error) {
      console.error('Error fetching table backgrounds:', error);
      toast({
        title: "Fout",
        description: "Kon tafel achtergronden niet laden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackgrounds();
  }, []);

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
        description: "Voer een naam in voor de achtergrond",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload to storage bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `table-bg-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('table-backgrounds')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('table-backgrounds')
        .getPublicUrl(filePath);

      // Save to database
      const { error: insertError } = await supabase
        .from('table_background_settings')
        .insert({
          name: formData.name,
          background_url: publicUrl,
          is_active: true
        });

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "Succes",
        description: "Tafel achtergrond succesvol geüpload",
      });

      // Reset form
      setFormData({ name: '', description: '' });
      
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }

      // Refresh backgrounds
      fetchBackgrounds();
      onBackgroundsChange?.();

    } catch (error) {
      console.error('Error uploading table background:', error);
      toast({
        title: "Fout",
        description: "Kon achtergrond niet uploaden",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, backgroundUrl: string) => {
    try {
      // Extract file path from URL for deletion
      const url = new URL(backgroundUrl);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];

      // Delete from storage
      await supabase.storage
        .from('table-backgrounds')
        .remove([fileName]);

      // Delete from database
      const { error } = await supabase
        .from('table_background_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Tafel achtergrond verwijderd",
      });

      fetchBackgrounds();
      onBackgroundsChange?.();
    } catch (error) {
      console.error('Error deleting table background:', error);
      toast({
        title: "Fout",
        description: "Kon achtergrond niet verwijderen",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('table_background_settings')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Succes",
        description: `Tafel achtergrond ${!currentActive ? 'geactiveerd' : 'gedeactiveerd'}`,
      });

      fetchBackgrounds();
      onBackgroundsChange?.();
    } catch (error) {
      console.error('Error toggling table background:', error);
      toast({
        title: "Fout",
        description: "Kon status niet wijzigen",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Laden...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Upload New Table Background */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nieuwe Tafel Achtergrond Uploaden
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Naam *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="bijv. Bella Vlag"
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

      {/* Manage Table Backgrounds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Beheer Tafel Achtergronden ({backgrounds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {backgrounds.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">
                Nog geen tafel achtergronden geüpload
              </p>
            ) : (
              backgrounds.map((background) => (
                <Card key={background.id} className="overflow-hidden">
                  <div className="aspect-video relative">
                    <img
                      src={background.background_url}
                      alt={background.name}
                      className="w-full h-full object-cover"
                    />
                    {background.is_active && (
                      <div className="absolute top-2 right-2">
                        <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Actief
                        </div>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium truncate">{background.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(background.created_at).toLocaleDateString('nl-NL')}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant={background.is_active ? "outline" : "default"}
                        onClick={() => handleToggleActive(background.id, background.is_active)}
                        className="flex-1"
                      >
                        {background.is_active ? 'Deactiveren' : 'Activeren'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(background.id, background.background_url)}
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