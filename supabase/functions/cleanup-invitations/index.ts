import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting invitation cleanup process...');

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call the cleanup function
    const { data, error } = await supabase.rpc('cleanup_expired_invitations');

    if (error) {
      console.error('Error cleaning up invitations:', error);
      throw error;
    }

    const deletedCount = data || 0;
    console.log(`Cleanup completed. Deleted ${deletedCount} expired invitations.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount,
        message: `Successfully cleaned up ${deletedCount} expired invitations`
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Cleanup function error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});