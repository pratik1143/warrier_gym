import os
import json
import urllib3
import requests
from requests.auth import HTTPDigestAuth

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DEVICE_IP = os.getenv("HIKVISION_HOST", "192.168.1.45")
DEVICE_PORT = int(os.getenv("HIKVISION_PORT", "443"))
PROTOCOL = os.getenv("HIKVISION_PROTOCOL", "https")
USERNAME = os.getenv("HIKVISION_USERNAME", "admin")
PASSWORD = os.getenv("HIKVISION_PASSWORD", "Password0@@")

BASE_URL = f"{PROTOCOL}://{DEVICE_IP}:{DEVICE_PORT}"
session = requests.Session()
session.auth = HTTPDigestAuth(USERNAME, PASSWORD)
session.verify = False

print("==================================================")
print("   HIKVISION DEEP DISCOVERY & EVENT INSPECTION   ")
print("==================================================")

# 1. Inspect recent AcsEvents with major=5 (Access Control Events)
# In Hikvision ISAPI, major=5 is typically Access Control (card/face/fingerprint authentication)
# major=1 is Alarm, major=2 is Exception, major=3 is Operation, major=5 is Event
event_search_body = {
    "AcsEventCond": {
        "searchID": "1",
        "searchResultPosition": 0,
        "maxResults": 10,
        "major": 5,
        "minor": 0
    }
}
resp = session.post(f"{BASE_URL}/ISAPI/AccessControl/AcsEvent?format=json", json=event_search_body, timeout=5)
print(f"Major 5 Event Search Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    print("AcsEvent Major 5 InfoList sample:")
    print(json.dumps(data.get("AcsEvent", {}).get("InfoList", [])[:3], indent=2))
else:
    print(resp.text[:300])

# 2. Inspect all recent events (major=0, minor=0, sorted by time or recent position)
total_matches = 1646
pos = max(0, total_matches - 10)
event_search_recent = {
    "AcsEventCond": {
        "searchID": "2",
        "searchResultPosition": pos,
        "maxResults": 10,
        "major": 0,
        "minor": 0
    }
}
resp2 = session.post(f"{BASE_URL}/ISAPI/AccessControl/AcsEvent?format=json", json=event_search_recent, timeout=5)
print(f"\nRecent Events (position {pos}) Status: {resp2.status_code}")
if resp2.status_code == 200:
    data2 = resp2.json()
    info_list = data2.get("AcsEvent", {}).get("InfoList", [])
    print(f"Found {len(info_list)} recent events:")
    print(json.dumps(info_list[:3], indent=2))
    # Look for employeeNo or cardNo or name
    for ev in info_list:
        if ev.get("employeeNo") or ev.get("cardNo") or ev.get("name"):
            print(f"-> Mapped event found: {ev}")

# 3. Test Alert Stream endpoint
print("\n[-] Testing /ISAPI/Event/notification/alertStream...")
try:
    stream_resp = session.get(f"{BASE_URL}/ISAPI/Event/notification/alertStream", stream=True, timeout=3)
    print(f"Alert Stream Status: {stream_resp.status_code} {stream_resp.reason}")
    print(f"Content-Type: {stream_resp.headers.get('Content-Type')}")
    # Read first chunk
    for chunk in stream_resp.iter_content(chunk_size=1024):
        if chunk:
            print("Alert stream chunk received:", chunk[:200])
            break
except requests.exceptions.Timeout:
    print("Alert Stream is connected and holding open (long-polling/streaming)!")
except Exception as ex:
    print(f"Alert Stream test result: {ex}")

# 4. Check Remote Control Door structure (WITHOUT triggering an open command yet)
# Capability showed: <cmd opt="open,close,alwaysOpen,alwaysClose">
# Let's check PUT XML/JSON format
print("\n[-] Checking Remote Control Door syntax...")
xml_door_cmd = '<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>'
# We will NOT execute unlock now, but check if PUT /ISAPI/AccessControl/RemoteControl/door/1?format=json or XML exists
