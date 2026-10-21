"""Quick Hikvision DS-K1T320EFWX connectivity check for The Warrior Gym.

Usage:  py warrior-biometric-agent\\ping_hikvision.py
Checks (1) TCP reachability of the terminal port and (2) authenticated ISAPI
/ISAPI/System/deviceInfo using the credentials from the agent's .env.
Prints PASS/FAIL per step. The password is never printed. Exit code 0 = all passed.
"""
import socket
import sys
import time
from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parent
if str(AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENT_ROOT))

import requests
import urllib3
from requests.auth import HTTPDigestAuth

from config.config import Config

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def tag(ok):
    return "PASS" if ok else "FAIL"


def main():
    host, port = Config.HIKVISION_HOST, Config.HIKVISION_PORT
    print("=" * 60)
    print(" THE WARRIOR GYM - HIKVISION TERMINAL CHECK")
    print("=" * 60)
    print(f" Target : {Config.HIKVISION_PROTOCOL}://{host}:{port}   user: {Config.HIKVISION_USERNAME}")
    print()

    started = time.time()
    tcp_ok = False
    try:
        with socket.create_connection((host, port), timeout=4):
            tcp_ok = True
    except OSError as exc:
        tcp_err = str(exc)
    ms = int((time.time() - started) * 1000)
    print(f" [{tag(tcp_ok)}] TCP port {port} reachable" + (f" ({ms} ms)" if tcp_ok else f" - {tcp_err}"))
    if not tcp_ok:
        print("\n Fix: check LAN cable/power of the terminal, that this PC is on the same network,")
        print("      and HIKVISION_HOST / HIKVISION_PORT in warrior-biometric-agent\\.env")
        return 1

    api_ok = False
    info = {}
    try:
        resp = requests.get(f"{Config.HIKVISION_PROTOCOL}://{host}:{port}/ISAPI/System/deviceInfo",
                            auth=HTTPDigestAuth(Config.HIKVISION_USERNAME, Config.HIKVISION_PASSWORD),
                            verify=False, timeout=8)
        if resp.status_code == 200:
            api_ok = True
            import xml.etree.ElementTree as ET
            root = ET.fromstring(resp.text)
            for elem in root.iter():
                name = elem.tag.split("}")[-1]
                if name in ("deviceName", "model", "serialNumber", "firmwareVersion") and elem.text:
                    info[name] = elem.text.strip()
            print(f" [PASS] ISAPI login OK (HTTP 200)")
            for key in ("model", "firmwareVersion", "serialNumber"):
                if key in info:
                    print(f"        {key}: {info[key]}")
        elif resp.status_code == 401:
            print(" [FAIL] ISAPI login rejected (HTTP 401) - wrong HIKVISION_USERNAME / HIKVISION_PASSWORD")
        else:
            print(f" [FAIL] ISAPI returned HTTP {resp.status_code}")
    except Exception as exc:
        print(f" [FAIL] ISAPI request error: {exc}")

    print()
    print(f" RESULT: {tag(tcp_ok and api_ok)}")
    return 0 if (tcp_ok and api_ok) else 1


if __name__ == "__main__":
    sys.exit(main())
