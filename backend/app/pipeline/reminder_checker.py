"""
Celery Beat periodic task for checking upcoming/overdue test reminders and sending email notifications.
Runs daily at 8:00 AM.
"""
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.email_service import send_reminder_email, is_smtp_configured

logger = logging.getLogger(__name__)
settings = get_settings()


def check_and_send_due_reminders():
    """
    Query active reminders due within the next 24 hours or already overdue,
    group them by user, and send a consolidated email notification per user.
    """
    if not is_smtp_configured():
        logger.info("SMTP is not configured. Skipping periodic reminder check.")
        return 0

    sync_db_url = settings.database_url.replace("+asyncpg", "+psycopg2")
    engine = create_engine(sync_db_url)
    SessionLocal = sessionmaker(bind=engine)

    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(hours=24)

    emails_sent = 0

    with SessionLocal() as session:
        from app.models import Reminder, User

        # Fetch all active reminders
        query = (
            select(Reminder, User)
            .join(User, Reminder.user_id == User.id)
            .where(Reminder.is_active == True)
        )
        all_results = session.execute(query).all()

        results = []
        for reminder, user in all_results:
            days = reminder.notify_before_days if reminder.notify_before_days is not None else 1
            # Check if reminder notification window has arrived (due date minus notify_before_days is <= now + 24h) or overdue
            notify_threshold = reminder.next_due_date - timedelta(days=days)
            if notify_threshold <= cutoff:
                results.append((reminder, user))

        if not results:
            logger.info("No due reminders found for email notifications.")
            return 0

        # Group reminders by user
        user_reminders_map = {}
        for reminder, user in results:
            if user.id not in user_reminders_map:
                user_reminders_map[user.id] = {
                    "user": user,
                    "reminders": [],
                }
            user_reminders_map[user.id]["reminders"].append({
                "title": reminder.title,
                "category": reminder.category,
                "due_date": reminder.next_due_date.strftime("%b %d, %Y"),
                "notes": reminder.notes,
            })

        # Send one consolidated email per user
        for u_id, data in user_reminders_map.items():
            user = data["user"]
            reminders = data["reminders"]
            target_email = user.notification_email or user.email

            try:
                success = send_reminder_email(
                    to_email=target_email,
                    recipient_name=user.full_name,
                    reminders_due=reminders,
                )
                if success:
                    emails_sent += 1
            except Exception as e:
                logger.error(f"Error sending periodic reminder email to {target_email}: {e}")

    logger.info(f"Periodic reminder check completed. Sent {emails_sent} reminder emails.")
    return emails_sent
