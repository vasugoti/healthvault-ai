from datetime import datetime, timezone, timedelta
from typing import Optional

IST_TZ = timezone(timedelta(hours=5, minutes=30))


def get_now_ist() -> datetime:
    return datetime.now(IST_TZ)


def parse_iso_datetime_ist(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        clean_str = dt_str.strip()
        if "T" in clean_str:
            dt = datetime.fromisoformat(clean_str.replace("Z", "+00:00"))
            return dt.replace(tzinfo=IST_TZ) if dt.tzinfo is None else dt
        dt = datetime.strptime(clean_str[:10], "%Y-%m-%d")
        return dt.replace(tzinfo=IST_TZ)
    except Exception:
        return get_now_ist()


def is_future_date_ist(dt: Optional[datetime]) -> bool:
    if not dt:
        return False
    return dt.astimezone(IST_TZ).date() > get_now_ist().date()
