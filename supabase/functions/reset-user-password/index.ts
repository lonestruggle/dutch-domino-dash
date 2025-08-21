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

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
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

    const { userId, newPassword }: ResetPasswordRequest = await req.json();

    console.log('Password reset request:', { userId, adminId: adminUser.id });

    // Validate input
    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate password strength (detailed check)
    if (newPassword.length < 8) {
      console.error('Password too short:', newPassword.length);
      return new Response(
        JSON.stringify({ error: 'Wachtwoord moet minimaal 8 karakters lang zijn' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if password contains at least one letter and one number
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      console.error('Password does not meet complexity requirements');
      return new Response(
        JSON.stringify({ error: 'Wachtwoord moet minimaal één letter en één cijfer bevatten' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Password validation passed. Length:', newPassword.length);

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get user profile to update display name in auth
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('user_id', userId)
      .single();

    console.log('About to reset password for user:', userId);

    // Reset user password using admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true,
      user_metadata: {
        display_name: profileData?.username || 'User',
        password_reset_at: new Date().toISOString()
      }
    });

    console.log('Password reset API response:', { data: data ? 'user object received' : 'no data', error });

    if (error) {
      console.error('Error resetting password:', error);
      return new Response(
        JSON.stringify({ error: 'Kon wachtwoord niet resetten: ' + error.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the password reset action for audit trail
    const { error: logError } = await supabaseAdmin
      .from('moderation_logs')
      .insert({
        moderator_id: adminUser.id,
        target_user_id: userId,
        action: 'password_reset',
        reason: 'Admin initiated password reset'
      });

    if (logError) {
      console.error('Error logging password reset:', logError);
      // Don't fail the request if logging fails
    }

    console.log('Password reset successful for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Wachtwoord succesvol gereset',
        user: data.user 
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in reset-user-password function:', error);
    return new Response(
      JSON.stringify({ error: 'Er is een onverwachte fout opgetreden' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
