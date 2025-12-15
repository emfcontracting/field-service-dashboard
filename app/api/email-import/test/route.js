// app/api/email-import/test/route.js
// Simple test endpoint to verify Gmail connection

export async function GET(request) {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // Check 1: Environment variables
  results.checks.env = {
    GMAIL_CLIENT_ID: !!process.env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: !!process.env.GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN: !!process.env.GMAIL_REFRESH_TOKEN,
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  };

  // Check 2: Try to get OAuth token
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });

    const data = await response.json();
    
    if (data.error) {
      results.checks.oauth = {
        success: false,
        error: data.error,
        error_description: data.error_description
      };
    } else {
      results.checks.oauth = {
        success: true,
        token_type: data.token_type,
        expires_in: data.expires_in
      };

      // Check 3: Try to list Gmail labels
      try {
        const labelsResponse = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/labels',
          {
            headers: { Authorization: `Bearer ${data.access_token}` }
          }
        );
        const labelsData = await labelsResponse.json();
        
        if (labelsData.error) {
          results.checks.gmail_labels = {
            success: false,
            error: labelsData.error.message
          };
        } else {
          // Find the dispatch label
          const dispatchLabel = labelsData.labels?.find(l => 
            l.name.toLowerCase() === 'dispatch'
          );
          
          results.checks.gmail_labels = {
            success: true,
            total_labels: labelsData.labels?.length || 0,
            dispatch_label_found: !!dispatchLabel,
            dispatch_label_id: dispatchLabel?.id || null
          };
        }
      } catch (labelErr) {
        results.checks.gmail_labels = {
          success: false,
          error: labelErr.message
        };
      }

      // Check 4: Try to search for dispatch emails
      try {
        const query = encodeURIComponent('is:unread label:dispatch');
        const searchResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=5`,
          {
            headers: { Authorization: `Bearer ${data.access_token}` }
          }
        );
        const searchData = await searchResponse.json();
        
        if (searchData.error) {
          results.checks.gmail_search = {
            success: false,
            error: searchData.error.message
          };
        } else {
          results.checks.gmail_search = {
            success: true,
            query: 'is:unread label:dispatch',
            unread_dispatch_count: searchData.messages?.length || 0,
            result_size_estimate: searchData.resultSizeEstimate || 0
          };
        }

        // Also check all dispatch emails (including read)
        const allQuery = encodeURIComponent('label:dispatch');
        const allSearchResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${allQuery}&maxResults=5`,
          {
            headers: { Authorization: `Bearer ${data.access_token}` }
          }
        );
        const allSearchData = await allSearchResponse.json();
        
        results.checks.gmail_search_all = {
          query: 'label:dispatch (all)',
          total_dispatch_count: allSearchData.messages?.length || 0,
          result_size_estimate: allSearchData.resultSizeEstimate || 0
        };

      } catch (searchErr) {
        results.checks.gmail_search = {
          success: false,
          error: searchErr.message
        };
      }
    }
  } catch (oauthErr) {
    results.checks.oauth = {
      success: false,
      error: oauthErr.message
    };
  }

  // Summary
  results.summary = {
    all_env_vars_present: Object.values(results.checks.env).every(v => v),
    oauth_working: results.checks.oauth?.success || false,
    dispatch_label_exists: results.checks.gmail_labels?.dispatch_label_found || false,
    has_unread_dispatch_emails: (results.checks.gmail_search?.unread_dispatch_count || 0) > 0
  };

  return Response.json(results, { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
