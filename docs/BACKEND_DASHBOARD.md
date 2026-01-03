# Backend Dashboard Documentation

## Overview
The Backend Dashboard is a comprehensive developer/admin tool for monitoring and managing the PCS FieldService system. It provides real-time system health monitoring, manual operation triggers, log viewing, and database statistics.

## Access
- **URL**: `/dashboard/backend`
- **Authentication**: Superuser only (jones.emfcontracting@gmail.com)
- **Quick Access**: Click the red "🛠️ Backend" button in the main dashboard header

## Features

### 1. Health Monitoring Tab
Real-time system health monitoring with auto-refresh capability:

#### System Checks:
- **Database Health**: Verifies Supabase connection
- **Email Import Status**: Tests IMAP connection to Gmail
- **Last Import**: Shows when the last work order was imported
- **Cron Jobs Status**: Monitors all automated jobs (email import, availability reminders, aging alerts)
- **Notification System**: Tracks email delivery success rates
- **Environment Variables**: Verifies all required env vars are present

#### Features:
- Auto-refresh every 30 seconds (toggleable)
- Manual refresh button
- Color-coded status indicators:
  - 🟢 Green = Healthy
  - 🟡 Yellow = Warning
  - 🔴 Red = Error
- Detailed error messages and timestamps

### 2. Triggers Tab
Manual controls for system operations:

#### Available Triggers:
1. **Force Email Import** - Manually run the IMAP email import cron job
2. **Send Availability Reminder** - Send availability reminder to all techs
3. **Trigger Aging Alert** - Send aging work order alerts
4. **Sync Email Status** - Update work order statuses from Gmail labels
5. **Test Notification** - Send a test email notification

#### Features:
- One-click execution
- Loading indicators during execution
- Detailed result dialogs with success/failure messages
- Automatic logging of all manual triggers
- Automatic refresh of health data and logs after execution

### 3. Logs Tab
Comprehensive system log viewer with advanced filtering:

#### Filters:
- **Log Type**: All, email_import, availability_reminder, aging_alert, manual_trigger, notification, error
- **Status**: All, success, failed, warning, info
- **Limit**: 50, 100, 200, or 500 logs

#### Statistics:
- Total logs count
- Logs in last hour
- Logs in last 24 hours
- Logs in last week

#### Features:
- Sortable table view
- Expandable metadata for each log entry
- Color-coded status badges
- Real-time timestamps
- Detailed error messages

### 4. Database Tab
Database statistics and monitoring:

#### Metrics:
- Work Orders count
- Users count
- Notifications count
- Daily Hours Log entries
- Team Members count
- Contractor Invoices count
- System Logs count

#### Features:
- Real-time data retrieval
- Manual refresh capability
- Error indicators for failed queries

## API Endpoints

### Health Check
```
GET /api/backend/health
```
Returns comprehensive system health status including database, email, cron jobs, notifications, and environment checks.

### Manual Triggers
```
POST /api/backend/trigger
Body: {
  "action": "email_import" | "availability_reminder" | "aging_alert" | "test_notification" | "sync_email_status",
  "params": {} // optional parameters
}
```
Executes manual system operations and returns detailed results.

### System Logs
```
GET /api/backend/logs?type={type}&status={status}&limit={limit}
```
Query parameters:
- `type`: Log type filter (default: 'all')
- `status`: Status filter (optional)
- `limit`: Number of logs to return (default: 100, max: 500)

Returns logs with statistics.

```
POST /api/backend/logs
Body: {
  "log_type": string,
  "message": string,
  "status": string (optional),
  "metadata": object (optional)
}
```
Creates a new log entry.

## Use Cases

### Debugging Production Issues
1. Go to Health tab to identify failing components
2. Check Logs tab for error details
3. Use Triggers tab to manually run operations for testing
4. Monitor results in real-time

### Monitoring System Health
1. Enable auto-refresh on Health tab
2. Watch for status changes
3. Check cron job execution times
4. Monitor notification success rates

### Manual Operations
1. Force email import after missed cron job
2. Send test notifications to verify email configuration
3. Trigger availability reminders outside normal schedule
4. Sync work order statuses manually

### Investigating Issues
1. Filter logs by type and status
2. Examine metadata for detailed error information
3. Check database statistics for data integrity
4. Review recent system activity

## Security

- **Authentication Required**: Only superuser (jones.emfcontracting@gmail.com) can access
- **Audit Logging**: All manual triggers are logged with user email
- **Read-Only Logs**: Cannot modify historical log entries
- **Confirmation Required**: Destructive actions show confirmation dialogs

## Best Practices

1. **Regular Monitoring**: Check health status daily
2. **Log Review**: Review error logs weekly
3. **Test Notifications**: Send test notifications after configuration changes
4. **Manual Triggers**: Use sparingly - only when automated systems fail
5. **Documentation**: Document any manual interventions in system logs

## Troubleshooting

### Health Check Shows Errors
1. Check environment variables are set correctly
2. Verify Gmail App Password is valid
3. Test database connection from Supabase dashboard
4. Check Vercel deployment logs

### Email Import Not Working
1. Use "Force Email Import" trigger
2. Check IMAP connection in Health tab
3. Verify Gmail credentials in .env.local
4. Review email_import logs for errors

### Cron Jobs Not Running
1. Verify Vercel cron configuration
2. Check CRON_SECRET environment variable
3. Manually trigger to test functionality
4. Review system_logs for execution history

### Logs Not Showing
1. Check system_logs table exists in Supabase
2. Verify Row Level Security policies
3. Ensure user has proper permissions
4. Check browser console for errors

## Future Enhancements

Potential additions:
- Real-time log streaming with WebSockets
- Advanced database query builder
- Performance metrics graphs
- Email template preview/editor
- User session management
- Push notification testing
- Work order bulk operations
- Database backup/restore tools
- System metrics dashboard
- Alert configuration interface

## Technical Details

### Architecture
- **Frontend**: Next.js 15 with Client Components
- **Backend**: Next.js API Routes
- **Database**: Supabase PostgreSQL
- **Email**: IMAP via node-imap package
- **Deployment**: Vercel with cron jobs

### Dependencies
- `@supabase/auth-helpers-nextjs`: Authentication
- `imap`: Email connection testing
- React hooks for state management
- Tailwind CSS for styling

### File Structure
```
/app/
  /dashboard/
    /backend/
      page.js           # Main dashboard UI
  /api/
    /backend/
      /health/
        route.js        # Health check endpoint
      /trigger/
        route.js        # Manual triggers endpoint
      /logs/
        route.js        # Logs query endpoint
```

## Maintenance

### Regular Tasks
- Monitor health status daily
- Review error logs weekly
- Test all triggers monthly
- Update documentation as features change
- Backup system logs quarterly

### Updates
When adding new features:
1. Update health checks if new services added
2. Add new trigger types as needed
3. Ensure proper logging for new operations
4. Update this documentation

## Support

For issues or questions:
1. Check system logs for detailed error messages
2. Review Vercel deployment logs
3. Test in development environment first
4. Contact system administrator if issues persist

---

**Last Updated**: January 3, 2026  
**Version**: 1.0.0  
**Maintainer**: Daniel Jones (jones.emfcontracting@gmail.com)
