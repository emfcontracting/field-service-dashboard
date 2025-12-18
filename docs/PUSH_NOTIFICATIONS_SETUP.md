# Push Notifications Setup Guide

## Overview
This implements FREE push notifications using the Web Push API with VAPID keys. 
No Firebase costs - completely free for unlimited notifications!

---

## Step 1: Generate VAPID Keys (One-time)

Run this command in your terminal:

```bash
cd C:\FSM\field-service-dashboard
npx web-push generate-vapid-keys
```

This will output something like:
```
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
UUxI4O8-FbRouADVXc-hK3ltRAc9dZm5AYLHHXA0wrY
```

---

## Step 2: Add Environment Variables

Add these to your `.env.local` file and Vercel environment variables:

```env
# VAPID Keys for Push Notifications (generated in Step 1)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
```

**Important:** 
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must have the `NEXT_PUBLIC_` prefix (it's used client-side)
- `VAPID_PRIVATE_KEY` is server-side only (no prefix needed)

---

## Step 3: Run Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT,
    auth_key TEXT,
    subscription_json TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_endpoint UNIQUE (user_id, endpoint)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);

-- Enable RLS with permissive policy
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all push_subscriptions operations" ON push_subscriptions
    FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON push_subscriptions TO anon, authenticated, service_role;
```

---

## Step 4: Install Dependencies

```bash
cd C:\FSM\field-service-dashboard
npm install web-push
```

---

## Step 5: Deploy

```bash
git add -A
git commit -m "Add push notifications support"
git push origin main
```

---

## Files Created/Modified

### New Files:
- `/public/manifest.json` - PWA manifest for installability
- `/public/sw.js` - Updated service worker with push handlers
- `/app/api/push/subscribe/route.js` - Subscription management API
- `/app/api/push/send/route.js` - Send notifications API
- `/app/mobile/hooks/usePushNotifications.js` - React hook for push
- `/app/mobile/components/PushNotificationPrompt.js` - Permission prompt UI
- `/app/mobile/components/NotificationSettings.js` - Settings toggle
- `/database/push_notifications_setup.sql` - Database migration

### Modified Files:
- `/app/layout.js` - Added manifest link
- `/app/mobile/page.js` - Added notification prompt
- `/app/dashboard/components/WorkOrderDetailModal.js` - Send push + email on assign
- `/package.json` - Added web-push dependency

---

## How It Works

### For Field Technicians:
1. Open mobile app → see permission prompt after 3 seconds
2. Tap "Enable Notifications" → browser asks for permission
3. On iOS: Must first "Add to Home Screen" (PWA requirement)
4. Once enabled, they'll receive instant push notifications

### For Office Staff (Dashboard):
1. Assign work order to field workers
2. System automatically sends:
   - **Push notification** (instant, free) - primary
   - **Email notification** (backup)
3. Emergency work orders get special vibration pattern

### Technical Flow:
```
Dashboard → /api/push/send → Web Push API → Service Worker → Native Notification
                                    ↓
                              push_subscriptions table
```

---

## Testing

1. Open mobile app on your phone
2. Enable notifications when prompted
3. From dashboard, assign a work order to yourself
4. You should receive an instant push notification!

---

## Costs

**$0 - Completely FREE!**
- Web Push API is free
- VAPID keys are self-generated
- No third-party service required
- Unlimited notifications

---

## iOS Notes

iOS requires:
- iOS 16.4+ 
- App must be installed to home screen (PWA)
- User must grant permission from the installed app

The app automatically detects iOS and shows installation instructions.

---

## Troubleshooting

**Notifications not appearing:**
1. Check browser notification permissions
2. Verify VAPID keys are set in environment
3. Check browser console for errors
4. On iOS, ensure app is installed to home screen

**Permission denied:**
1. User must manually enable in browser settings
2. On iOS: Settings → Safari → Notifications

**Subscription not saving:**
1. Check Supabase table exists
2. Verify RLS policies are correct
3. Check API route logs in Vercel
