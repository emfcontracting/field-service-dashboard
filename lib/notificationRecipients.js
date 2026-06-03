// lib/notificationRecipients.js
// Shared helper for resolving who gets notified for each event type.
// Uses the `notification_subscriptions` table populated by the
// Messages > Notifications tab.

/**
 * Fetch all users subscribed to a specific notification type.
 *
 * @param {SupabaseClient} supabase - Authenticated Supabase client
 * @param {string} notificationType - e.g. 'missing_data_fixed', 'work_order_completed'
 * @param {object} options
 * @param {string} [options.excludeUserId] - Don't return this user (e.g. the actor themselves)
 * @returns {Promise<Array<{user_id, email, first_name, last_name}>>}
 */
export async function getSubscribers(supabase, notificationType, { excludeUserId } = {}) {
  if (!supabase || !notificationType) return [];

  try {
    // Pull subscription rows with embedded user data.
    // We rely on the foreign-key relationship created by the migration.
    const { data, error } = await supabase
      .from('notification_subscriptions')
      .select(`
        user_id,
        enabled,
        user:users!notification_subscriptions_user_id_fkey(
          user_id, first_name, last_name, email, is_active
        )
      `)
      .eq('notification_type', notificationType)
      .eq('enabled', true);

    if (error) {
      console.error('getSubscribers query error:', error);
      return [];
    }

    const recipients = (data || [])
      .map(row => row.user)
      .filter(u => u && u.is_active && u.email)
      .filter(u => u.user_id !== excludeUserId);

    return recipients;
  } catch (err) {
    console.error('getSubscribers exception:', err);
    return [];
  }
}

/**
 * Convenience wrapper that fires a notification using the subscriber list.
 * Returns the fetch response. Caller can ignore the result if fire-and-forget.
 *
 * @param {SupabaseClient} supabase
 * @param {object} payload
 * @param {string} payload.type
 * @param {object} payload.workOrder
 * @param {string} payload.actorName
 * @param {Array}  [payload.missingDataItems]
 * @param {Array}  [payload.updateRequiredItems]
 * @param {string} [payload.excludeUserId]
 */
export async function sendSubscribedNotification(supabase, payload) {
  const { type, workOrder, actorName, missingDataItems, updateRequiredItems, excludeUserId } = payload;

  const recipients = await getSubscribers(supabase, type, { excludeUserId });

  if (recipients.length === 0) {
    console.warn(`No subscribers found for notification type "${type}"`);
    return { ok: false, reason: 'no_subscribers' };
  }

  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        recipients,
        workOrder,
        actorName,
        ...(missingDataItems ? { missingDataItems } : {}),
        ...(updateRequiredItems ? { updateRequiredItems } : {})
      })
    });
    const result = await response.json();
    return { ok: response.ok, result };
  } catch (err) {
    console.error('sendSubscribedNotification dispatch error:', err);
    return { ok: false, reason: err.message };
  }
}
