"""
Email notification service using Python standard library smtplib and email.mime.
Supports HTML reminder digest emails and SMTP verification test emails.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any

from app.config import get_settings

logger = logging.getLogger(__name__)


def is_smtp_configured() -> bool:
    """Check if SMTP settings are populated."""
    settings = get_settings()
    return bool(settings.smtp_user and settings.smtp_password and settings.smtp_host)


def send_email_message(to_email: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via SMTP server."""
    settings = get_settings()

    if not is_smtp_configured():
        logger.warning("SMTP credentials are not fully configured in environment. Skipping email sending.")
        raise ValueError("SMTP credentials are not configured. Please set SMTP_USER and SMTP_PASSWORD in backend/.env")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_user, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_user, [to_email], msg.as_string())

        logger.info(f"Email successfully sent to {to_email} with subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}", exc_info=True)
        raise RuntimeError(f"Failed to send email via SMTP: {str(e)}")


def send_reminder_email(to_email: str, recipient_name: str, reminders_due: List[Dict[str, Any]]) -> bool:
    """
    Send an HTML reminder email to the user listing their upcoming or overdue health test reminders.
    """
    subject = f"🩺 HealthVault AI: {len(reminders_due)} Health Test Reminder{'s' if len(reminders_due) > 1 else ''} Due"

    reminder_rows_html = ""
    for r in reminders_due:
        title = r.get("title", "Health Test")
        category = r.get("category", "General").replace("_", " ").title()
        due_date = r.get("due_date", "Today")
        notes = r.get("notes", "")

        notes_html = f'<p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; font-style: italic;">"{notes}"</p>' if notes else ""

        reminder_rows_html += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 16px; font-weight: 600; color: #0f172a;">
            {title}
            {notes_html}
          </td>
          <td style="padding: 12px 16px;">
            <span style="background-color: #eff6ff; color: #1d4ed8; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">
              {category}
            </span>
          </td>
          <td style="padding: 12px 16px; font-weight: 600; color: #dc2626;">
            {due_date}
          </td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Health Reminder</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 30px 15px;">
            <table role="presentation" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 24px 32px; text-align: left;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    🩺 HealthVault AI
                  </h1>
                  <p style="color: #93c5fd; margin: 6px 0 0 0; font-size: 14px;">
                    Personalized Health Test Reminder Digest
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e293b; font-weight: 500;">
                    Hello {recipient_name},
                  </p>
                  <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.5;">
                    This is a reminder from HealthVault AI regarding your upcoming medical tests and health monitoring routines. Staying on schedule with your tests helps keep your health records up to date.
                  </p>

                  <!-- Reminders Table -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px; overflow: hidden; margin-bottom: 24px; font-size: 14px;">
                    <thead>
                      <tr style="background-color: #f1f5f9; text-align: left; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                        <th style="padding: 10px 16px;">Test Title</th>
                        <th style="padding: 10px 16px;">Category</th>
                        <th style="padding: 10px 16px;">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reminder_rows_html}
                    </tbody>
                  </table>

                  <!-- Call to action button -->
                  <div style="text-align: center; margin: 32px 0 16px 0;">
                    <a href="http://localhost:3000/reminders" target="_blank" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">
                      View Health Reminders Dashboard &rarr;
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.4;">
                  <p style="margin: 0 0 6px 0;">HealthVault AI — AI-Powered Personal Health Intelligence</p>
                  <p style="margin: 0;">You are receiving this automated email based on your scheduled reminders.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    return send_email_message(to_email, subject, html_content)


def send_test_email(to_email: str, recipient_name: str) -> bool:
    """Send a test email to verify SMTP configuration."""
    subject = "✅ HealthVault AI Test Notification Email"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Test Notification</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: sans-serif;">
      <table role="presentation" style="width: 100%; padding: 30px;">
        <tr>
          <td align="center">
            <table role="presentation" style="max-width: 550px; width: 100%; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px;">
              <h2 style="color: #2563eb; margin-top: 0;">🩺 HealthVault AI Email Test</h2>
              <p style="font-size: 15px; color: #334155;">Hello <strong>{recipient_name}</strong>,</p>
              <p style="font-size: 14px; color: #475569; line-height: 1.5;">
                This is a test notification confirming that your HealthVault AI email reminder settings are configured correctly!
              </p>
              <p style="font-size: 14px; color: #475569;">
                Target Notification Email: <strong>{to_email}</strong>
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="font-size: 12px; color: #94a3b8;">HealthVault AI Automated Email System</p>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
    return send_email_message(to_email, subject, html_content)
