// lib/expoPush.js — send native push notifications to the mobile tech app via
// the Expo Push API. Tokens are stored in the `push_tokens` table by the app.
//
// This is separate from the existing web-push (VAPID) system used by the
// browser dashboard — both can run side by side.

import { getSupabase } from './supabase';

// Look up all Expo push tokens registered for a given technician (user_id).
export async function getUserPushTokens(userId) {
  if (!userId) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId);
  if (error) {
    console.error('push_tokens fetch error:', error);
    return [];
  }
  return (data || []).map((r) => r.expo_push_token).filter(Boolean);
}

// Send a notification to a list of Expo push tokens.
export async function sendExpoPush(tokens, { title, body, data } = {}) {
  const messages = (tokens || [])
    .filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'))
    .map((to) => ({ to, sound: 'default', title, body, data: data || {} }));

  if (messages.length === 0) return { sent: 0 };

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const response = await res.json().catch(() => null);
  return { sent: messages.length, response };
}

// Convenience: notify a single technician by user_id.
export async function notifyTech(userId, title, body, data) {
  const tokens = await getUserPushTokens(userId);
  return sendExpoPush(tokens, { title, body, data });
}
