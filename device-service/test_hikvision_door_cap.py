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

print("=== CHECKING REMOTE CONTROL DOOR SCHEMA ===")
# Testing XML capability
resp = session.get(f"{BASE_URL}/ISAPI/AccessControl/RemoteControl/door/capabilities")
print(f"Capabilities (XML): Status {resp.status_code}")
print(resp.text)

# Testing JSON capability
resp_json = session.get(f"{BASE_URL}/ISAPI/AccessControl/RemoteControl/door/capabilities?format=json")
print(f"\nCapabilities (JSON): Status {resp_json.status_code}")
print(resp_json.text)
