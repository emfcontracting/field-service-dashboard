// app/api/push/subscribe/route.js
// Handles push notification subscription management
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { subscription, user_id, refreshed } = await request.json();
    
    if (!subscription || !user_id) {
      return NextResponse.json(
        { error: 'Missing subscription or user_id' },
        { status: 400 }
      );
    }

    // Store the subscription in the database
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user_id,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys?.p256dh,
        auth_key: subscription.keys?.auth,
        subscription_json: JSON.stringify(subscription),
        updated_at: new Date().toISOString(),
        is_active: true
      }, {
        onConflict: 'user_id,endpoint'
      });

    if (error) {
      console.error('Error saving subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Push subscription ${refreshed ? 'refreshed' : 'saved'} for user ${user_id}`);
    
    return NextResponse.json({ 
      success: true, 
      message: refreshed ? 'Subscription refreshed' : 'Subscription saved'
    });

  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Handle unsubscribe
export async function DELETE(request) {
  try {
    const { endpoint, user_id } = await request.json();
    
    if (!endpoint || !user_id) {
      return NextResponse.json(
        { error: 'Missing endpoint or user_id' },
        { status: 400 }
      );
    }

    // Mark subscription as inactive
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', user_id)
      .eq('endpoint', endpoint);

    if (error) {
      console.error('Error removing subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Push subscription removed for user ${user_id}`);
    
    return NextResponse.json({ success: true, message: 'Unsubscribed' });

  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
