import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // Fetch all work orders
    const { data: workOrders, error: woError } = await supabase
      .from('work_orders')
      .select('*');

    if (woError) throw woError;

    // Fetch users for technician stats
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, role')
      .eq('is_active', true);

    if (usersError) throw usersError;

    // Calculate metrics
    const analytics = {
      overview: calculateOverview(workOrders),
      byStatus: groupByStatus(workOrders),
      byPriority: groupByPriority(workOrders),
      byBuilding: groupByBuilding(workOrders),
      aging: calculateAging(workOrders),
      technicians: calculateTechnicianStats(workOrders, users),
      financial: calculateFinancial(workOrders),
      trends: calculateTrends(workOrders, days),
      recent: filterRecent(workOrders, startDateStr)
    };

    return NextResponse.json({
      success: true,
      analytics,
      period: {
        days,
        startDate: startDateStr,
        endDate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch analytics',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// Calculate overview metrics
function calculateOverview(workOrders) {
  const total = workOrders.length;
  const open = workOrders.filter(wo => 
    ['pending', 'assigned', 'in_progress'].includes(wo.status)
  ).length;
  const completed = workOrders.filter(wo => wo.status === 'completed').length;
  const billed = workOrders.filter(wo => 
    wo.billing_status === 'invoiced' || wo.billing_status === 'paid'
  ).length;

  return {
    total,
    open,
    completed,
    billed,
    completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0
  };
}

// Group by status
function groupByStatus(workOrders) {
  const statusCounts = {};
  workOrders.forEach(wo => {
    const status = wo.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  return statusCounts;
}

// Group by priority
function groupByPriority(workOrders) {
  const priorityCounts = {};
  workOrders.forEach(wo => {
    const priority = wo.priority || 'medium';
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
  });
  return priorityCounts;
}

// Group by building (top 10)
function groupByBuilding(workOrders) {
  const buildingCounts = {};
  workOrders.forEach(wo => {
    if (wo.building) {
      buildingCounts[wo.building] = (buildingCounts[wo.building] || 0) + 1;
    }
  });

  // Sort and return top 10
  return Object.entries(buildingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [building, count]) => {
      obj[building] = count;
      return obj;
    }, {});
}

// Calculate aging metrics
function calculateAging(workOrders) {
  const now = new Date();
  const aging = {
    current: 0,      // 0-3 days
    recent: 0,       // 4-7 days
    moderate: 0,     // 8-14 days
    old: 0,          // 15-30 days
    critical: 0,     // 30+ days
    byRange: []
  };

  const openWorkOrders = workOrders.filter(wo => 
    ['pending', 'assigned', 'in_progress'].includes(wo.status)
  );

  openWorkOrders.forEach(wo => {
    const enteredDate = new Date(wo.date_entered);
    const ageInDays = Math.floor((now - enteredDate) / (1000 * 60 * 60 * 24));

    if (ageInDays <= 3) aging.current++;
    else if (ageInDays <= 7) aging.recent++;
    else if (ageInDays <= 14) aging.moderate++;
    else if (ageInDays <= 30) aging.old++;
    else aging.critical++;
  });

  aging.byRange = [
    { range: '0-3 days', count: aging.current, color: '#10b981' },
    { range: '4-7 days', count: aging.recent, color: '#3b82f6' },
    { range: '8-14 days', count: aging.moderate, color: '#f59e0b' },
    { range: '15-30 days', count: aging.old, color: '#ef4444' },
    { range: '30+ days', count: aging.critical, color: '#991b1b' }
  ];

  return aging;
}

// Calculate technician stats
function calculateTechnicianStats(workOrders, users) {
  const techStats = {};

  // Get technicians
  const technicians = users.filter(u => 
    ['lead_tech', 'tech', 'helper'].includes(u.role)
  );

  technicians.forEach(tech => {
    const techId = tech.user_id;
    const techName = `${tech.first_name} ${tech.last_name}`;

    // Count assigned work orders
    const assigned = workOrders.filter(wo => wo.assigned_to === techId);
    const completed = assigned.filter(wo => wo.status === 'completed');
    const inProgress = assigned.filter(wo => wo.status === 'in_progress');
    const pending = assigned.filter(wo => wo.status === 'pending' || wo.status === 'assigned');

    // Calculate total hours (if available)
    let totalHours = 0;
    assigned.forEach(wo => {
      if (wo.total_hours) totalHours += parseFloat(wo.total_hours);
    });

    techStats[techName] = {
      userId: techId,
      role: tech.role,
      totalJobs: assigned.length,
      completed: completed.length,
      inProgress: inProgress.length,
      pending: pending.length,
      totalHours: totalHours.toFixed(1),
      completionRate: assigned.length > 0 
        ? ((completed.length / assigned.length) * 100).toFixed(1) 
        : 0
    };
  });

  return techStats;
}

// Calculate financial metrics
function calculateFinancial(workOrders) {
  let totalNTE = 0;
  let totalCost = 0;
  let totalBilled = 0;
  let quotedAmount = 0;

  workOrders.forEach(wo => {
    if (wo.nte) totalNTE += parseFloat(wo.nte);
    if (wo.total_cost) totalCost += parseFloat(wo.total_cost);
    if (wo.invoice_amount) totalBilled += parseFloat(wo.invoice_amount);
    
    // Track quoted amounts for pending quotes
    if (wo.billing_status === 'quoted' && wo.quote_amount) {
      quotedAmount += parseFloat(wo.quote_amount);
    }
  });

  const margin = totalBilled > 0 
    ? (((totalBilled - totalCost) / totalBilled) * 100).toFixed(1)
    : 0;

  return {
    totalNTE: totalNTE.toFixed(2),
    totalCost: totalCost.toFixed(2),
    totalBilled: totalBilled.toFixed(2),
    quotedAmount: quotedAmount.toFixed(2),
    margin: margin,
    averageJobCost: workOrders.length > 0 
      ? (totalCost / workOrders.length).toFixed(2)
      : 0
  };
}

// Calculate trends over time
function calculateTrends(workOrders, days) {
  const trends = {
    daily: [],
    weekly: []
  };

  const now = new Date();
  const daysArray = [];

  // Generate last N days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    daysArray.push(date.toISOString().split('T')[0]);
  }

  // Count work orders entered each day
  daysArray.forEach(dateStr => {
    const woOnDate = workOrders.filter(wo => {
      const woDate = new Date(wo.date_entered).toISOString().split('T')[0];
      return woDate === dateStr;
    });

    trends.daily.push({
      date: dateStr,
      count: woOnDate.length,
      completed: woOnDate.filter(wo => wo.status === 'completed').length
    });
  });

  return trends;
}

// Filter recent work orders
function filterRecent(workOrders, startDateStr) {
  return {
    count: workOrders.filter(wo => wo.date_entered >= startDateStr).length,
    completed: workOrders.filter(wo => 
      wo.date_entered >= startDateStr && wo.status === 'completed'
    ).length
  };
}
