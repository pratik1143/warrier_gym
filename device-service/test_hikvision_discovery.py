import os
import sys
import json
import urllib3
import requests
from requests.auth import HTTPDigestAuth, HTTPBasicAuth

# Suppress insecure SSL warnings for local device self-signed certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DEVICE_IP = os.getenv("HIKVISION_HOST", "192.168.1.45")
DEVICE_PORT = int(os.getenv("HIKVISION_PORT", "443"))
PROTOCOL = os.getenv("HIKVISION_PROTOCOL", "https")
USERNAME = os.getenv("HIKVISION_USERNAME", "admin")
PASSWORD = os.getenv("HIKVISION_PASSWORD", "Password0@@")

BASE_URL = f"{PROTOCOL}://{DEVICE_IP}:{DEVICE_PORT}"

print("==================================================")
print("   HIKVISION DS-K1T320EFWX DISCOVERY & CAPABILITY ")
print("==================================================")
print(f"Target: {BASE_URL}")
print(f"Auth User: {USERNAME}")
print("==================================================")

auth = HTTPDigestAuth(USERNAME, PASSWORD)
session = requests.Session()
session.auth = auth
session.verify = False

def probe(name, method, path, data=None, headers=None):
    url = f"{BASE_URL}{path}"
    print(f"\n[-] Testing {name} [{method} {path}]...")
    try:
        if headers is None:
            headers = {}
        if data and isinstance(data, dict):
            headers["Content-Type"] = "application/json"
            body = json.dumps(data)
        elif data:
            body = data
        else:
            body = None

        resp = session.request(method, url, data=body, headers=headers, timeout=5)
        print(f"    Status: {resp.status_code} {resp.reason}")
        print(f"    Content-Type: {resp.headers.get('Content-Type', 'N/A')}")
        text = resp.text[:500]
        print(f"    Body snippet: {text.strip()}")
        return resp
    except Exception as e:
        print(f"    FAILED: {e}")
        return None

# 1. Device Info
probe("Device Info", "GET", "/ISAPI/System/deviceInfo")

# 2. System Status
probe("System Status", "GET", "/ISAPI/System/status")

# 3. System Capabilities
probe("System Capabilities", "GET", "/ISAPI/System/capabilities")

# 4. Access Control Capabilities
probe("AccessControl Capabilities", "GET", "/ISAPI/AccessControl/capabilities")

# 5. Access Control Status
probe("AccessControl Status", "GET", "/ISAPI/AccessControl/AcsStatus")

# 6. Door Capabilities
probe("Door Capabilities", "GET", "/ISAPI/AccessControl/door/capabilities")

# 7. Door Info
probe("Door Info", "GET", "/ISAPI/AccessControl/door")
probe("Door 1 Info", "GET", "/ISAPI/AccessControl/door/1")

# 8. User Info Search Capabilities
probe("UserInfo Capabilities", "GET", "/ISAPI/AccessControl/UserInfo/capabilities")

# 9. User Search (POST JSON)
search_user_body = {
    "UserInfoSearchCond": {
        "searchID": "1",
        "searchResultPosition": 0,
        "maxResults": 5
    }
}
probe("UserInfo Search (JSON)", "POST", "/ISAPI/AccessControl/UserInfo/Search?format=json", data=search_user_body)

# 10. AcsEvent Search (POST JSON)
event_search_body = {
    "AcsEventCond": {
        "searchID": "1",
        "searchResultPosition": 0,
        "maxResults": 5,
        "major": 0,
        "minor": 0
    }
}
probe("AcsEvent Search (JSON)", "POST", "/ISAPI/AccessControl/AcsEvent?format=json", data=event_search_body)

# 11. Door Remote Control Capabilities
probe("RemoteControl Door Capabilities", "GET", "/ISAPI/AccessControl/RemoteControl/door/capabilities")

print("\n==================================================")
print("   DISCOVERY PROBE FINISHED")
print("==================================================")
