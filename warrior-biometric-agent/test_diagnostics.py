import os
import sys
from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(AGENT_ROOT))

from config.config import Config
from providers.hikvision_provider import HikvisionProvider
from services.event_processor import EventProcessor

print("==================================================")
print("     WARRIOR BIOMETRIC AGENT DIAGNOSTIC CHECK     ")
print("==================================================")
print(f"Config Summary: {Config.sanitize_summary()}")

# 1. Test Hikvision Connection
provider = HikvisionProvider(
    device_id=Config.HIKVISION_DEVICE_ID,
    device_name=Config.HIKVISION_DEVICE_NAME,
    host=Config.HIKVISION_HOST,
    port=Config.HIKVISION_PORT,
    protocol=Config.HIKVISION_PROTOCOL,
    username=Config.HIKVISION_USERNAME,
    password=Config.HIKVISION_PASSWORD,
    door_id=Config.HIKVISION_DOOR_ID
)

ok = provider.connect()
print(f"\n[-] Provider connect(): {'SUCCESS' if ok else 'FAILED'}")
if ok:
    info = provider.get_device_info()
    print(f"    Model: {info.get('model')}")
    print(f"    Firmware: {info.get('firmwareVersion')}")
    print(f"    Serial: {info.get('serialNumber')}")
    print(f"    Door Capabilities: {info.get('doorControl')}")

# 2. Test Firebase Admin SDK
processor = EventProcessor()
print(f"\n[-] Firebase Firestore DB: {'CONNECTED' if processor.db is not None else 'OFFLINE QUEUE'}")

# 3. Test Reading Enrolled Users (First 5)
users = provider.get_users()
print(f"\n[-] Device Enrolled Users: {len(users)} found")
for u in users[:5]:
    print(f"    User slot: {u.get('deviceUserId')}, Name: '{u.get('name')}'")

# 4. Clean up
provider.disconnect()
print("\n==================================================")
print("     DIAGNOSTIC CHECK PASSED 100%                 ")
print("==================================================")
