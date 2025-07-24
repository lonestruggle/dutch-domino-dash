import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting display name sync...');

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get all users with their profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, username')
      .not('username', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Kon profielen niet ophalen: ' + profilesError.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${profiles?.length || 0} profiles to sync`);

    let synced = 0;
    let errors = 0;

    // Update each user's display name in auth
    for (const profile of profiles || []) {
      try {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
          user_metadata: {
            display_name: profile.username
          }
        });

        if (error) {
          console.error(`Error updating user ${profile.user_id}:`, error);
          errors++;
        } else {
          console.log(`Synced display name for user ${profile.user_id}: ${profile.username}`);
          synced++;
        }
      } catch (error) {
        console.error(`Exception updating user ${profile.user_id}:`, error);
        errors++;
      }
    }

    console.log(`Sync complete. Synced: ${synced}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Display names gesynced voor ${synced} gebruikers`,
        synced,
        errors
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in sync-display-names function:', error);
    return new Response(
      JSON.stringify({ error: 'Er is een onverwachte fout opgetreden' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});