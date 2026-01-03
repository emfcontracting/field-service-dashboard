import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Imap from 'imap';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Check if user is superuser
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.email !== 'jones.emfcontracting@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const healthData = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {}
    };

    // 1. Database Health
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id')
        .limit(1);
      
      healthData.checks.database = {
        status: error ? 'error' : 'healthy',
        message: error ? error.message : 'Connected',
        lastChecked: new Date().toISOString()
      };
    } catch (err) {
      healthData.checks.database = {
        status: 'error',
        message: err.message,
        lastChecked: new Date().toISOString()
      };
    }

    // 2. Email Import Status (IMAP)
    try {
      const imapHealth = await checkImapConnection();
      healthData.checks.emailImport = imapHealth;
    } catch (err) {
      healthData.checks.emailImport = {
        status: 'error',
        message: err.message,
        lastChecked: new Date().toISOString()
      };
    }

    // 3. Last Email Import
    try {
      const { data: lastImport, error } = await supabase
        .from('work_orders')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const minutesSinceImport = lastImport 
        ? Math.floor((Date.now() - new Date(lastImport.created_at).getTime()) / 60000)
        : null;

      healthData.checks.lastImport = {
        status: minutesSinceImport === null ? 'unknown' : minutesSinceImport > 1440 ? 'warning' : 'healthy',
        lastImportAt: lastImport?.created_at || null,
        minutesAgo: minutesSinceImport,
        message: minutesSinceImport === null 
          ? 'No imports found' 
          : minutesSinceImport > 1440 
            ? `Last import ${minutesSinceImport} minutes ago (>24 hours)`
            : `Last import ${minutesSinceImport} minutes ago`
      };
    } catch (err) {
      healthData.checks.lastImport = {
        status: 'error',
        message: err.message
      };
    }

    // 4. Cron Jobs Status (check system_logs for recent cron runs)
    try {
      const { data: cronLogs, error } = await supabase
        .from('system_logs')
        .select('*')
        .in('log_type', ['email_import', 'availability_reminder', 'aging_alert'])
        .order('created_at', { ascending: false })
        .limit(10);

      const cronStatus = {
        email_import: { status: 'unknown', lastRun: null },
        availability_reminder: { status: 'unknown', lastRun: null },
        aging_alert: { status: 'unknown', lastRun: null }
      };

      if (cronLogs) {
        cronLogs.forEach(log => {
          const type = log.log_type;
          if (!cronStatus[type].lastRun) {
            cronStatus[type] = {
              status: log.status || 'success',
              lastRun: log.created_at,
              message: log.message
            };
          }
        });
      }

      healthData.checks.cronJobs = cronStatus;
    } catch (err) {
      healthData.checks.cronJobs = {
        status: 'error',
        message: err.message
      };
    }

    // 5. Notification System
    try {
      const { data: recentNotifications, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayNotifs = recentNotifications?.filter(n => 
        new Date(n.created_at) >= today
      ) || [];

      const failed = todayNotifs.filter(n => n.status === 'failed').length;
      const sent = todayNotifs.filter(n => n.status === 'sent').length;

      healthData.checks.notifications = {
        status: failed > sent * 0.1 ? 'warning' : 'healthy',
        sentToday: sent,
        failedToday: failed,
        totalToday: todayNotifs.length,
        successRate: todayNotifs.length > 0 
          ? `${((sent / todayNotifs.length) * 100).toFixed(1)}%` 
          : 'N/A'
      };
    } catch (err) {
      healthData.checks.notifications = {
        status: 'error',
        message: err.message
      };
    }

    // 6. Environment Variables Check
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GMAIL_USER',
      'GMAIL_APP_PASSWORD'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    healthData.checks.environment = {
      status: missingEnvVars.length > 0 ? 'error' : 'healthy',
      message: missingEnvVars.length > 0 
        ? `Missing: ${missingEnvVars.join(', ')}`
        : 'All required env vars present',
      missingVars: missingEnvVars
    };

    // Overall status
    const hasErrors = Object.values(healthData.checks).some(check => 
      check.status === 'error'
    );
    const hasWarnings = Object.values(healthData.checks).some(check => 
      check.status === 'warning'
    );

    healthData.status = hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy';

    return NextResponse.json(healthData);
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        error: 'Health check failed',
        message: error.message,
        status: 'error'
      },
      { status: 500 }
    );
  }
}

// Helper function to check IMAP connection
async function checkImapConnection() {
  return new Promise((resolve) => {
    const imap = new Imap({
      user: process.env.GMAIL_USER,
      password: process.env.GMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    let timeout = setTimeout(() => {
      imap.end();
      resolve({
        status: 'error',
        message: 'IMAP connection timeout',
        lastChecked: new Date().toISOString()
      });
    }, 10000);

    imap.once('ready', () => {
      clearTimeout(timeout);
      imap.end();
      resolve({
        status: 'healthy',
        message: 'IMAP connection successful',
        lastChecked: new Date().toISOString()
      });
    });

    imap.once('error', (err) => {
      clearTimeout(timeout);
      resolve({
        status: 'error',
        message: `IMAP error: ${err.message}`,
        lastChecked: new Date().toISOString()
      });
    });

    imap.connect();
  });
}
