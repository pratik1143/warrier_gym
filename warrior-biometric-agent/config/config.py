import os
import sys
from pathlib import Path

# Base directory for the biometric agent
BASE_DIR = Path(__file__).resolve().parent.parent

# Discover .env file
def load_env():
    candidates = [
        BASE_DIR / ".env",
        BASE_DIR.parent / "backend" / ".env",
        BASE_DIR.parent / ".env",
    ]
    for env_path in candidates:
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v
            break

load_env()

class Config:
    # Active Biometric Provider: 'hikvision', 'essl', or 'both'
    ACTIVE_PROVIDER = os.getenv("ACTIVE_BIOMETRIC_PROVIDER", "hikvision").lower()

    # Hikvision Terminal Config
    HIKVISION_HOST = os.getenv("HIKVISION_HOST", "192.168.1.45")
    HIKVISION_PORT = int(os.getenv("HIKVISION_PORT", "443"))
    HIKVISION_PROTOCOL = os.getenv("HIKVISION_PROTOCOL", "https").lower()
    HIKVISION_USERNAME = os.getenv("HIKVISION_USERNAME", "admin")
    HIKVISION_PASSWORD = os.getenv("HIKVISION_PASSWORD", "Password0@@")
    HIKVISION_DEVICE_ID = os.getenv("HIKVISION_DEVICE_ID", "hikvision-main-gate")
    HIKVISION_DEVICE_NAME = os.getenv("HIKVISION_DEVICE_NAME", "The Warrior Gym - Main Entrance")
    HIKVISION_DOOR_ID = int(os.getenv("HIKVISION_DOOR_ID", "1"))
    HIKVISION_BRANCH = os.getenv("HIKVISION_BRANCH", "The Warrior Gym Main Branch")

    # ESSL Terminal Config (Preserved for full dual-compatibility)
    ESSL_HOST = os.getenv("ESSL_HOST", "192.168.18.11")
    ESSL_PORT = int(os.getenv("ESSL_PORT", "4370"))
    ESSL_DEVICE_ID = os.getenv("ESSL_DEVICE_ID", "dev_k90_main")
    ESSL_DEVICE_NAME = os.getenv("ESSL_DEVICE_NAME", "ESSL K90 Pro")

    # Connection & Retry Settings
    POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "3"))
    CONNECTION_TIMEOUT_SECONDS = int(os.getenv("CONNECTION_TIMEOUT_SECONDS", "5"))
    RECONNECT_BACKOFF_SECONDS = int(os.getenv("RECONNECT_BACKOFF_SECONDS", "5"))

    # Backend API URL
    BACKEND_API_URL = os.getenv("WARRIOR_BACKEND_URL", "http://localhost:5000/api")

    # Paths
    LOG_FILE = BASE_DIR / "logs" / "warrior_biometric_agent.log"
    OFFLINE_QUEUE_FILE = BASE_DIR / "offline_punch_queue.json"

    @classmethod
    def resolve_firebase_credentials(cls):
        env_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
        if env_path and Path(env_path).exists():
            return Path(env_path)
        candidates = [
            BASE_DIR / "serviceAccountKey.json",
            BASE_DIR.parent / "backend" / "serviceAccountKey.json",
            BASE_DIR.parent / "device-service" / "serviceAccountKey.json",
            BASE_DIR.parent / "serviceAccountKey.json",
        ]
        for c in candidates:
            if c.exists():
                return c
        return None

    @classmethod
    def sanitize_summary(cls):
        return {
            "ACTIVE_PROVIDER": cls.ACTIVE_PROVIDER,
            "HIKVISION_HOST": cls.HIKVISION_HOST,
            "HIKVISION_PORT": cls.HIKVISION_PORT,
            "HIKVISION_PROTOCOL": cls.HIKVISION_PROTOCOL,
            "HIKVISION_USERNAME": cls.HIKVISION_USERNAME,
            "HIKVISION_PASSWORD": "***REDACTED***",
            "HIKVISION_DEVICE_ID": cls.HIKVISION_DEVICE_ID,
            "HIKVISION_DOOR_ID": cls.HIKVISION_DOOR_ID,
            "ESSL_HOST": cls.ESSL_HOST,
            "ESSL_PORT": cls.ESSL_PORT,
            "BACKEND_API_URL": cls.BACKEND_API_URL,
        }
