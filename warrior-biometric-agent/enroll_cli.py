import sys
import json
from pathlib import Path

# Add root of warrior-biometric-agent to sys.path
AGENT_ROOT = Path(__file__).resolve().parent
if str(AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENT_ROOT))

from providers.hikvision_provider import HikvisionProvider
from config.config import Config

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing command argument"}))
        sys.exit(1)

    cmd = sys.argv[1]
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

    if cmd == "diagnostics":
        res = provider.run_diagnostics()
        print(json.dumps(res))
    elif cmd in ("create_user", "provision"):
        emp_no = sys.argv[2] if len(sys.argv) > 2 else "101"
        name = sys.argv[3] if len(sys.argv) > 3 else "Member"
        res = provider.create_user(emp_no, name)
        print(json.dumps(res))
    elif cmd == "capabilities":
        res = provider.get_capabilities()
        print(json.dumps(res))
    elif cmd in ("get_users", "list_users"):
        users = provider.get_users()
        print(json.dumps({"success": True, "users": users, "count": len(users)}))
    elif cmd == "test_connection":
        res = provider.test_connection_matrix()
        print(json.dumps(res))
    elif cmd == "enroll_face":
        emp_no = sys.argv[2] if len(sys.argv) > 2 else "101"
        name = sys.argv[3] if len(sys.argv) > 3 else "Member"
        prov = provider.create_user(emp_no, name)
        if not prov.get("success") and not prov.get("requiresTerminalAction"):
            print(json.dumps(prov))
            sys.exit(0)
        res = provider.enroll_face(emp_no)
        print(json.dumps(res))
    elif cmd == "enroll_fingerprint":
        emp_no = sys.argv[2] if len(sys.argv) > 2 else "101"
        name = sys.argv[3] if len(sys.argv) > 3 else "Member"
        prov = provider.create_user(emp_no, name)
        if not prov.get("success") and not prov.get("requiresTerminalAction"):
            print(json.dumps(prov))
            sys.exit(0)
        res = provider.enroll_fingerprint(emp_no)
        print(json.dumps(res))
    elif cmd == "enroll_both":
        emp_no = sys.argv[2] if len(sys.argv) > 2 else "101"
        name = sys.argv[3] if len(sys.argv) > 3 else "Member"
        prov = provider.create_user(emp_no, name)
        if not prov.get("success") and not prov.get("requiresTerminalAction"):
            print(json.dumps(prov))
            sys.exit(0)
        face_res = provider.enroll_face(emp_no)
        fp_res = provider.enroll_fingerprint(emp_no)
        is_succ = face_res.get("success", False) or fp_res.get("success", False)
        combined = {
            "success": is_succ,
            "requiresTerminalAction": (not is_succ) and (face_res.get("requiresTerminalAction") or fp_res.get("requiresTerminalAction")),
            "face": face_res,
            "fingerprint": fp_res,
            "endpoint": fp_res.get("endpoint") or face_res.get("endpoint") or "/ISAPI/AccessControl/FingerPrint/SetUp?format=json",
            "httpMethod": "POST",
            "httpStatus": fp_res.get("httpStatus") or face_res.get("httpStatus") or 200,
            "message": fp_res.get("message") or face_res.get("message") or f"Enrollment active on terminal for #{emp_no}"
        }
        print(json.dumps(combined))
    else:
        print(json.dumps({"success": False, "error": f"Unknown command {cmd}"}))

if __name__ == "__main__":
    main()
