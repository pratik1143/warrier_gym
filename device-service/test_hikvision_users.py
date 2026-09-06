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

search_body = {
    "UserInfoSearchCond": {
        "searchID": "all_users",
        "searchResultPosition": 0,
        "maxResults": 30
    }
}
resp = session.post(f"{BASE_URL}/ISAPI/AccessControl/UserInfo/Search?format=json", json=search_body, timeout=5)
if resp.status_code == 200:
    data = resp.json()
    users = data.get("UserInfoSearch", {}).get("UserInfo", [])
    total = data.get("UserInfoSearch", {}).get("totalMatches", 0)
    print(f"Total Users on Hikvision Device: {total}")
    print(f"First {len(users)} users:")
    for u in users[:15]:
        print(f"  EmployeeNo: {u.get('employeeNo')}, Name: '{u.get('name')}', UserType: {u.get('userType')}, Valid: {u.get('Valid', {}).get('enable')}")
else:
    print("Error reading users:", resp.status_code, resp.text)
