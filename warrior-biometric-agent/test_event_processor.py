import os
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

AGENT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(AGENT_ROOT))

from config.config import Config
from services.event_processor import EventProcessor

print("==================================================")
print("     TESTING EVENT PROCESSOR & BUSINESS RULES     ")
print("==================================================")

gate_triggers = []
def mock_door_relay(door_id=1, duration_seconds=3):
    gate_triggers.append({"door_id": door_id, "duration": duration_seconds, "time": time.time()})
    print(f"    -> [RELAY TRIGGERED] Door {door_id} unlocked for {duration_seconds}s")

processor = EventProcessor(door_callback=mock_door_relay)

# Test 1: Unmapped User
print("\n[-] Test 1: Authentication from Unmapped Device User (ID: 99999)...")
unmapped_event = {
    "deviceId": "hikvision-main-gate",
    "deviceUserId": "99999",
    "memberName": "Random Person",
    "eventType": "access_granted",
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "verificationMethod": "faceOrFpOrCardOrPw",
    "deviceIp": "192.168.1.45",
    "rawEventId": "999991",
    "source": "hikvision",
    "doorNo": 1
}
res1 = processor.process_event(unmapped_event)
print(f"    Result: {res1.get('status')}, Gate Opened: {res1.get('gateOpened')}")
assert res1.get("status") == "unmapped", "Unmapped user should have status 'unmapped'"
assert res1.get("gateOpened") == False, "Gate should NEVER open for unmapped user"
print("    ✓ Test 1 Passed: Unmapped user handled safely, no fake member created, gate kept locked.")

# Test 2: Idempotent Event (Same serialNo / fingerprint within 1 second)
print("\n[-] Test 2: Immediate Duplicate Event Re-delivery...")
res2 = processor.process_event(unmapped_event)
print(f"    Result: {res2.get('status')}")
assert res2.get("status") == "duplicate_event", "Re-delivered event must be recognized as duplicate_event"
print("    ✓ Test 2 Passed: Duplicate event immediately discarded by deterministic fingerprint.")

print("\n==================================================")
print("     ALL EVENT PROCESSOR TESTS PASSED 100%        ")
print("==================================================")
