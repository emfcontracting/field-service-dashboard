import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
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
      metadata: { action, result }
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
    // Import nodemailer dynamically
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'emfcbre@gmail.com',
        pass: process.env.EMAIL_PASS
      }
    });

    const testEmail = 'jones.emfcontracting@gmail.com';
    
    const info = await transporter.sendMail({
      from: `"PCS FieldService Backend" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
      to: testEmail,
      subject: '✅ Backend Dashboard Test Notification',
      text: 'This is a test notification from the PCS FieldService Backend Dashboard. If you received this, the notification system is working correctly!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ Test Notification Successful</h2>
          </div>
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <p>This is a test notification from the <strong>PCS FieldService Backend Dashboard</strong>.</p>
            <p>If you received this email, the notification system is working correctly!</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
              Sent: ${new Date().toLocaleString()}<br>
              From: Backend Dashboard Manual Trigger
            </p>
          </div>
        </div>
      `
    });
    
    console.log('Test email sent:', info.messageId);
    
    return {
      success: true,
      action: 'test_notification',
      message: `Test email sent successfully to ${testEmail}`,
      details: { 
        recipient: testEmail,
        messageId: info.messageId 
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Test notification error:', error);
    return {
      success: false,
      action: 'test_notification',
      message: `Failed to send test email: ${error.message}`,
      error: error.message,
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
