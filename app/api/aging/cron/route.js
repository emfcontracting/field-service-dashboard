// This file is intentionally empty - cron functionality removed
// Manual email alerts are available via /api/aging/send-alerts
export async function GET() {
  return Response.json({ 
    message: 'Cron disabled. Use manual alerts from dashboard instead.',
    manualEndpoint: '/api/aging/send-alerts'
  });
}

export async function POST() {
  return GET();
}
