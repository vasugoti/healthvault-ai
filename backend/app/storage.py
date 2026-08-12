import io
from datetime import timedelta
from minio import Minio
from minio.error import S3Error

from app.config import get_settings

settings = get_settings()

_client: Minio | None = None


def get_minio_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=settings.minio_secure,
        )
    return _client


def ensure_bucket_exists():
    client = get_minio_client()
    try:
        if not client.bucket_exists(settings.minio_bucket):
            client.make_bucket(settings.minio_bucket)
    except S3Error as e:
        raise RuntimeError(f"MinIO bucket creation failed: {e}")


def upload_file(object_key: str, data: bytes, content_type: str) -> str:
    client = get_minio_client()
    client.put_object(
        settings.minio_bucket,
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return object_key


def get_presigned_url(object_key: str, expiry_seconds: int = 3600) -> str:
    client = get_minio_client()
    return client.presigned_get_object(
        settings.minio_bucket,
        object_key,
        expires=timedelta(seconds=expiry_seconds),
    )


def download_file(object_key: str) -> bytes:
    client = get_minio_client()
    response = client.get_object(settings.minio_bucket, object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def delete_file(object_key: str):
    client = get_minio_client()
    client.remove_object(settings.minio_bucket, object_key)
