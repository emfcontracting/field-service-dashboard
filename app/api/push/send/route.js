// app/api/push/send/route.js
// Sends push notifications using Web Push protocol
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Configure web-push with VAPID keys lazily (not at build time)
let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;
  
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  
  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not configured. Push notifications will not work.');
    return false;
  }
  
  webpush.setVapidDetails(
    'mailto:emfcbre@gmail.com',
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
}

export async function POST(request) {
  try {
    // Configure VAPID at runtime, not build time
    if (!ensureVapidConfigured()) {
      return NextResponse.json(
        { error: 'Push notifications not configured. VAPID keys missing.' },
        { status: 503 }
      );
    }

    const { user_ids, title, body, data, priority } = await request.json();

    if (!user_ids || user_ids.length === 0) {
      return NextResponse.json(
        { error: 'No user_ids provided' },
        { status: 400 }
      );
    }

    // Get active subscriptions for these users
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', user_ids)
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active push subscriptions found for users:', user_ids);
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No active subscriptions found'
      });
    }

    // Build notification payload
    const payload = JSON.stringify({
      title: title || 'EMF Contracting',
      body: body || 'You have a new notification',
      icon: '/emf-logo.png',
      badge: '/emf-logo.png',
      priority: priority || 'normal',
      ...data
    });

    // Send to all subscriptions
    const results = [];
    const errors = [];
    const expiredSubscriptions = [];

    for (const sub of subscriptions) {
      try {
        const pushSubscription = JSON.parse(sub.subscription_json);

        await webpush.sendNotification(pushSubscription, payload);

        results.push({
          user_id: sub.user_id,
          status: 'sent'
        });

        console.log(`✅ Push sent to user ${sub.user_id}`);

      } catch (pushError) {
        console.error(`Push error for user ${sub.user_id}:`, pushError.statusCode, pushError.body);

        // Handle expired or invalid subscriptions
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          expiredSubscriptions.push(sub.id);
          errors.push({
            user_id: sub.user_id,
            error: 'Subscription expired',
            statusCode: pushError.statusCode
          });
        } else {
          errors.push({
            user_id: sub.user_id,
            error: pushError.message || 'Push failed',
            statusCode: pushError.statusCode
          });
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('id', expiredSubscriptions);

      console.log(`🧹 Marked ${expiredSubscriptions.length} expired subscriptions as inactive`);
    }

    return NextResponse.json({
      success: true,
      sent: results.length,
      failed: errors.length,
      results,
      errors,
      expiredCleaned: expiredSubscriptions.length
    });

  } catch (error) {
    console.error('Push send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint to check VAPID public key availability
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json({
      configured: false,
      message: 'VAPID keys not configured. Run: npx web-push generate-vapid-keys'
    });
  }

  return NextResponse.json({
    configured: true,
    publicKey
  });
}
