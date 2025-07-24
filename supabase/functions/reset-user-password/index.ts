import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
  adminId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, newPassword, adminId }: ResetPasswordRequest = await req.json();

    console.log('Password reset request:', { userId, adminId });

    // Validate input
    if (!userId || !newPassword || !adminId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Wachtwoord moet minimaal 6 karakters lang zijn' }), 
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

    // Get user profile to update display name in auth
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('user_id', userId)
      .single();

    // Reset user password using admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true,  // Force confirm the password change
      user_metadata: {
        display_name: profileData?.username || 'User'
      }
    });

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
        moderator_id: adminId,
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