import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const supabase = await createClient();
    
    // Check if user is superuser
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.email !== 'jones.emfcontracting@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, params } = await request.json();

    let result;
    
    switch (action) {
      case 'email_import':
        result = await triggerEmailImport();
        break;
        
      case 'availability_reminder':
        result = await triggerAvailabilityReminder();
        break;
        
      case 'aging_alert':
        result = await triggerAgingAlert();
        break;
        
      case 'test_notification':
        result = await sendTestNotification(params);
        break;
        
      case 'sync_email_status':
        result = await syncEmailStatus();
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action', validActions: [
            'email_import',
            'availability_reminder',
            'aging_alert',
            'test_notification',
            'sync_email_status'
          ]},
          { status: 400 }
        );
    }

    // Log the action
    await supabase.from('system_logs').insert({
      log_type: 'manual_trigger',
      message: `Manual trigger: ${action}`,
      status: result.success ? 'success' : 'failed',
      metadata: { action, result, triggeredBy: user.email }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Trigger error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Trigger failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}

async function triggerEmailImport() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://field-service-dashboard.vercel.app'}/api/email-import/cron`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      action: 'email_import',
      message: response.ok ? 'Email import triggered successfully' : 'Email import failed',
      details: data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      action: 'email_import',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function triggerAvailabilityReminder() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://field-service-dashboard.vercel.app'}/api/availability/reminder-cron`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      action: 'availability_reminder',
      message: response.ok ? 'Availability reminder sent successfully' : 'Availability reminder failed',
      details: data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      action: 'availability_reminder',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function triggerAgingAlert() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://field-service-dashboard.vercel.app'}/api/aging/cron`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      action: 'aging_alert',
      message: response.ok ? 'Aging alert triggered successfully' : 'Aging alert failed',
      details: data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      action: 'aging_alert',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function sendTestNotification(params) {
  try {
    const { email, message } = params || {};
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://field-service-dashboard.vercel.app'}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: email || 'jones.emfcontracting@gmail.com',
        subject: 'Test Notification from Backend Dashboard',
        text: message || 'This is a test notification from the PCS FieldService Backend Dashboard.',
        html: `<p>${message || 'This is a test notification from the PCS FieldService Backend Dashboard.'}</p>`
      })
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      action: 'test_notification',
      message: response.ok ? 'Test notification sent successfully' : 'Test notification failed',
      details: data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      action: 'test_notification',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function syncEmailStatus() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://field-service-dashboard.vercel.app'}/api/email-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      action: 'sync_email_status',
      message: response.ok ? 'Email status sync completed' : 'Email status sync failed',
      details: data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      action: 'sync_email_status',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
