import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const supabase = await createClient();
    
    // Check if user is superuser
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.email !== 'jones.emfcontracting@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const logType = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');
    const status = searchParams.get('status');

    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500)); // Max 500 logs

    // Filter by log type
    if (logType !== 'all') {
      query = query.eq('log_type', logType);
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    const { data: logs, error } = await query;

    if (error) {
      throw error;
    }

    // Get stats
    const stats = {
      total: logs.length,
      byType: {},
      byStatus: {},
      recent: {
        lastHour: 0,
        last24Hours: 0,
        lastWeek: 0
      }
    };

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    logs.forEach(log => {
      // Count by type
      stats.byType[log.log_type] = (stats.byType[log.log_type] || 0) + 1;
      
      // Count by status
      stats.byStatus[log.status || 'unknown'] = (stats.byStatus[log.status || 'unknown'] || 0) + 1;

      // Count by time
      const logTime = new Date(log.created_at).getTime();
      const age = now - logTime;
      
      if (age <= oneHour) stats.recent.lastHour++;
      if (age <= oneDay) stats.recent.last24Hours++;
      if (age <= oneWeek) stats.recent.lastWeek++;
    });

    return NextResponse.json({
      logs,
      stats,
      filters: {
        type: logType,
        status: status || 'all',
        limit
      }
    });
  } catch (error) {
    console.error('Logs fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch logs',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST endpoint to create a log entry
export async function POST(request) {
  try {
    const supabase = await createClient();
    
    // Check if user is superuser
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.email !== 'jones.emfcontracting@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { log_type, message, status, metadata } = await request.json();

    if (!log_type || !message) {
      return NextResponse.json(
        { error: 'log_type and message are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('system_logs')
      .insert({
        log_type,
        message,
        status: status || 'info',
        metadata: metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, log: data });
  } catch (error) {
    console.error('Log creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create log',
        message: error.message
      },
      { status: 500 }
    );
  }
}
