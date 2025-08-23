import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting lobby cleanup process...')

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Call the cleanup function
    const { data, error } = await supabaseAdmin.rpc('cleanup_expired_lobbies')

    if (error) {
      console.error('Error cleaning up lobbies:', error)
      throw error
    }

    const deletedCount = data || 0
    console.log(`Cleanup completed. Deleted ${deletedCount} expired lobbies.`)

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount,
        message: `Successfully cleaned up ${deletedCount} expired lobbies`,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    )
  } catch (error) {
    console.error('Lobby cleanup function error:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    )
  }
})