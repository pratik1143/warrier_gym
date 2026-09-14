import os
import sys
import json
import base64
from pathlib import Path
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

def get_session():
    s = requests.Session()
    s.auth = HTTPDigestAuth(USERNAME, PASSWORD)
    s.verify = False
    return s

def fetch_all_users_with_photos():
    """
    Fetches all user records from Hikvision terminal via ISAPI UserInfo/Search.
    Extracts employeeNo, name, numOfFace, faceURL, numOfFP, etc.
    """
    session = get_session()
    all_users = []
    search_pos = 0
    max_fetch = 30
    total_matches = 0

    try:
        while True:
            search_body = {
                "UserInfoSearchCond": {
                    "searchID": "photo_sync_users",
                    "searchResultPosition": search_pos,
                    "maxResults": max_fetch
                }
            }
            resp = session.post(
                f"{BASE_URL}/ISAPI/AccessControl/UserInfo/Search?format=json",
                json=search_body,
                timeout=8
            )
            if resp.status_code != 200:
                return {
                    "success": False,
                    "error": f"Hikvision returned HTTP {resp.status_code}: {resp.text[:200]}",
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
                face_url = u.get("faceURL") or None

                all_users.append({
                    "employeeNo": emp_no,
                    "name": (u.get("name") or "").strip(),
                    "userType": u.get("userType", "normal"),
                    "numOfFace": num_face,
                    "hasFace": num_face > 0 or bool(face_url),
                    "faceURL": face_url,
                    "numOfFP": num_fp,
                    "hasFingerprint": num_fp > 0,
                    "valid": u.get("Valid", {}).get("enable", True),
                    "doorRight": u.get("doorRight", "1")
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

def download_user_photo(employee_no: str, face_url: str = None, save_path: str = None):
    """
    Downloads the face photo for a specific employee.
    If face_url is not provided, queries UserInfo/Search first to find it.
    Saves image to save_path if provided, or returns base64 JPEG bytes.
    """
    session = get_session()
    emp_clean = str(employee_no).strip()

    if not face_url:
        # Search user specifically
        search_body = {
            "UserInfoSearchCond": {
                "searchID": f"photo_get_{emp_clean}",
                "searchResultPosition": 0,
                "maxResults": 1,
                "EmployeeNoList": [{"employeeNo": emp_clean}]
            }
        }
        try:
            resp = session.post(
                f"{BASE_URL}/ISAPI/AccessControl/UserInfo/Search?format=json",
                json=search_body,
                timeout=6
            )
            if resp.status_code == 200:
                data = resp.json().get("UserInfoSearch", {})
                users = data.get("UserInfo", [])
                if users:
                    face_url = users[0].get("faceURL")
        except Exception as ex:
            return {
                "success": False,
                "employeeNo": emp_clean,
                "error": f"Failed searching user: {ex}",
                "endpoint": "/ISAPI/AccessControl/UserInfo/Search?format=json"
            }

    if not face_url:
        return {
            "success": False,
            "employeeNo": emp_clean,
            "error": f"No faceURL found on Hikvision terminal for user #{emp_clean}",
            "endpoint": "/ISAPI/AccessControl/UserInfo/Search?format=json",
            "photoAvailable": False
        }

    # Fetch the image URL
    try:
        img_resp = session.get(face_url, timeout=10)
        if img_resp.status_code != 200:
            return {
                "success": False,
                "employeeNo": emp_clean,
                "faceURL": face_url,
                "httpStatus": img_resp.status_code,
                "error": f"Failed to download image from {face_url} (HTTP {img_resp.status_code})",
                "photoAvailable": True
            }

        content_bytes = img_resp.content
        if len(content_bytes) < 100 or content_bytes[:3] != b'\xff\xd8\xff':
            # Check if PNG or other format or error body
            if content_bytes[:4] != b'\x89PNG':
                return {
                    "success": False,
                    "employeeNo": emp_clean,
                    "faceURL": face_url,
                    "error": f"Invalid image format received (bytes length={len(content_bytes)})",
                    "photoAvailable": True
                }

        if save_path:
            p = Path(save_path)
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, "wb") as f:
                f.write(content_bytes)

        return {
            "success": True,
            "employeeNo": emp_clean,
            "faceURL": face_url,
            "sizeBytes": len(content_bytes),
            "savePath": save_path,
            "base64": base64.b64encode(content_bytes).decode("ascii"),
            "photoAvailable": True
        }
    except Exception as e:
        return {
            "success": False,
            "employeeNo": emp_clean,
            "faceURL": face_url,
            "error": str(e),
            "photoAvailable": True
        }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()
        if cmd == "list":
            result = fetch_all_users_with_photos()
            print(json.dumps(result))
        elif cmd == "download":
            emp = sys.argv[2] if len(sys.argv) > 2 else ""
            out = sys.argv[3] if len(sys.argv) > 3 else None
            f_url = sys.argv[4] if len(sys.argv) > 4 else None
            result = download_user_photo(emp, face_url=f_url, save_path=out)
            # Avoid dumping gigantic base64 if save_path was provided
            if out and result.get("success"):
                result["base64"] = f"[Written to {out} ({result.get('sizeBytes')} bytes)]"
            print(json.dumps(result))
        else:
            print(json.dumps({"error": f"Unknown command {cmd}"}))
    else:
        # Default: list all users
        print(json.dumps(fetch_all_users_with_photos()))
