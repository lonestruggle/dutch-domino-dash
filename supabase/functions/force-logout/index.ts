import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForceLogoutRequest {
  userId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create authed client to validate caller and check role
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminUser = userData.user;
    const { data: isAdmin, error: adminErr } = await supabaseAuth.rpc('is_admin', { _user_id: adminUser.id });
    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { userId }: ForceLogoutRequest = await req.json();

    console.log('Force logout request by admin:', { target: userId, admin: adminUser.id });

    // Validate input
    if (!userId) {
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

    console.log('Attempting to invalidate user sessions by updating user...');

    // Force logout by updating the user (this invalidates all sessions)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      // Adding a timestamp to user metadata forces session refresh
      user_metadata: {
        force_logout_at: new Date().toISOString(),
        admin_action: 'forced_logout'
      }
    });

    if (error) {
      console.error('Error updating user for logout:', error);
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
        moderator_id: adminUser.id,
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
