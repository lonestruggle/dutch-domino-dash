import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForceLogoutRequest {
  userId: string;
  adminId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, adminId }: ForceLogoutRequest = await req.json();

    console.log('Force logout request:', { userId, adminId });

    // Validate input
    if (!userId || !adminId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Attempting to sign out user sessions...');

    // Sign out all sessions for the user
    const { error } = await supabaseAdmin.auth.admin.signOut(userId, 'global');

    if (error) {
      console.error('Error signing out user:', error);
      return new Response(
        JSON.stringify({ error: 'Kon gebruiker niet uitloggen: ' + error.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the action for audit trail
    const { error: logError } = await supabaseAdmin
      .from('moderation_logs')
      .insert({
        moderator_id: adminId,
        target_user_id: userId,
        action: 'force_logout',
        reason: 'Admin initiated force logout'
      });

    if (logError) {
      console.error('Error logging force logout:', logError);
      // Don't fail the request if logging fails
    }

    console.log('Force logout successful for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Gebruiker succesvol uitgelogd van alle sessies'
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in force-logout function:', error);
    return new Response(
      JSON.stringify({ error: 'Er is een onverwachte fout opgetreden' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});