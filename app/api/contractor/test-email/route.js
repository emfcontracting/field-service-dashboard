// app/api/contractor/test-email/route.js
// Test endpoint to verify email configuration for subcontractor invoices
import nodemailer from 'nodemailer';

export async function GET(request) {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // Check 1: Environment variables
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  results.checks.env = {
    EMAIL_USER: !!emailUser,
    EMAIL_USER_VALUE: emailUser || 'NOT SET',
    EMAIL_PASS: !!emailPass,
    EMAIL_PASS_LENGTH: emailPass?.length || 0
  };

  if (!emailUser || !emailPass) {
    results.summary = {
      canSendEmail: false,
      error: 'EMAIL_USER or EMAIL_PASS environment variable not set'
    };
    return Response.json(results);
  }

  // Check 2: Try to create transporter and verify
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    await transporter.verify();
    
    results.checks.smtp = {
      success: true,
      message: 'SMTP connection verified successfully'
    };
  } catch (error) {
    results.checks.smtp = {
      success: false,
      error: error.message,
      code: error.code
    };
    results.summary = {
      canSendEmail: false,
      error: `SMTP verification failed: ${error.message}`
    };
    return Response.json(results);
  }

  // Check 3: Try to send a test email (optional - only if ?sendTest=true)
  const { searchParams } = new URL(request.url);
  const sendTest = searchParams.get('sendTest') === 'true';
  const testEmail = searchParams.get('to') || 'emfcontractingsc2@gmail.com';

  if (sendTest) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });

      const info = await transporter.sendMail({
        from: `"EMF Test" <${emailUser}>`,
        to: testEmail,
        subject: `Test Email - ${new Date().toLocaleString()}`,
        html: `
          <h2>Email Test Successful</h2>
          <p>This is a test email from the EMF Subcontractor Portal.</p>
          <p>If you received this, the email system is working correctly.</p>
          <p>Sent at: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
        `
      });

      results.checks.testEmail = {
        success: true,
        sentTo: testEmail,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      results.checks.testEmail = {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  } else {
    results.checks.testEmail = {
      skipped: true,
      message: 'Add ?sendTest=true&to=your@email.com to send a test email'
    };
  }

  results.summary = {
    canSendEmail: results.checks.smtp.success,
    emailUser: emailUser,
    recommendation: results.checks.smtp.success 
      ? 'Email configuration looks good. If emails still not arriving, check spam folder or recipient email.' 
      : 'Fix SMTP configuration issues first.'
  };

  return Response.json(results);
}
