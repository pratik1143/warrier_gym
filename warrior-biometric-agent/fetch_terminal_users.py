import sys
import json
from pathlib import Path
import urllib3
import requests
from requests.auth import HTTPDigestAuth

urllib3.disable_warnings()

def fetch_users():
    base = "https://192.168.1.45:443"
    username = "admin"
    password = "Password0@@"

    session = requests.Session()
    session.auth = HTTPDigestAuth(username, password)
    session.verify = False

    all_users = []
    search_pos = 0
    max_fetch = 30
    total_matches = 0

    try:
        while True:
            search_body = {
                "UserInfoSearchCond": {
                    "searchID": "all_terminal_users",
                    "searchResultPosition": search_pos,
                    "maxResults": max_fetch
                }
            }
            resp = session.post(
                f"{base}/ISAPI/AccessControl/UserInfo/Search?format=json",
                json=search_body,
                timeout=5
            )
            if resp.status_code != 200:
                return {
                    "success": False,
                    "error": f"Device returned HTTP {resp.status_code}: {resp.text[:200]}",
                    "endpoint": "/ISAPI/AccessControl/UserInfo/Search?format=json",
                    "users": all_users,
                    "count": len(all_users)
                }

            data = resp.json().get("UserInfoSearch", {})
            users = data.get("UserInfo", [])
            total_matches = data.get("totalMatches", len(all_users))

            if not users:
                break

            for u in users:
                emp_no = str(u.get("employeeNo", "")).strip()
                if not emp_no:
                    continue
                num_face = int(u.get("numOfFace", 0))
                num_fp = int(u.get("numOfFP", 0))
                all_users.append({
                    "employeeNo": emp_no,
                    "userId": emp_no,
                    "deviceUserId": emp_no,
                    "name": u.get("name") or "",
                    "userType": u.get("userType", "normal"),
                    "numOfFace": num_face,
                    "numOfFP": num_fp,
                    "hasFace": num_face > 0,
                    "hasFingerprint": num_fp > 0,
                    "faceURL": u.get("faceURL") or None,
                    "doorRight": u.get("doorRight", "1"),
                    "valid": u.get("Valid", {}).get("enable", True),
                })

            search_pos += len(users)
            if search_pos >= total_matches or len(users) < max_fetch:
                break

        return {
            "success": True,
            "endpoint": "/ISAPI/AccessControl/UserInfo/Search?format=json",
            "totalMatches": total_matches,
            "count": len(all_users),
            "users": all_users
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "endpoint": "/ISAPI/AccessControl/UserInfo/Search?format=json",
            "users": all_users,
            "count": len(all_users)
        }

if __name__ == "__main__":
    result = fetch_users()
    print(json.dumps(result))
