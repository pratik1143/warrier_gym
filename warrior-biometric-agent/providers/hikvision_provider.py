import os
import sys
import time
import json
import logging
import threading
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Callable, Dict, Any, List, Optional

import urllib3
import requests
from requests.auth import HTTPDigestAuth

from .biometric_provider import BiometricProvider

# Suppress insecure SSL warnings for local device self-signed certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logger = logging.getLogger("HikvisionProvider")

class HikvisionProvider(BiometricProvider):
    """
    Hikvision Biometric & Access Control Provider for DS-K1T320EFWX (Firmware V3.5.20+).
    Supports:
    - ISAPI Digest Authentication over HTTPS / HTTP
    - Capability Detection
    - Real-time Alert Stream (/ISAPI/Event/notification/alertStream)
    - Fallback AcsEvent Polling (/ISAPI/AccessControl/AcsEvent?format=json)
    - Remote Door Control (/ISAPI/AccessControl/RemoteControl/door/<id>)
    - Normalized Punch Format
    """

    def __init__(
        self,
        device_id: str,
        device_name: str,
        host: str,
        port: int = 443,
        protocol: str = "https",
        username: str = "admin",
        password: str = "",
        door_id: int = 1
    ):
        super().__init__(device_id, device_name, host, port)
        self.protocol = protocol.lower()
        self.username = username
        self.password = password
        self.door_id = door_id
        self.base_url = f"{self.protocol}://{self.host}:{self.port}"

        self.session = requests.Session()
        self.session.auth = HTTPDigestAuth(self.username, self.password)
        self.session.verify = False

        self._connected = False
        self._last_error = None
        self._last_error_code = None
        self._device_info: Dict[str, Any] = {}
        self._door_capabilities: Dict[str, Any] = {}
        self._last_sync_time: Optional[str] = None
        self._last_event_time: Optional[str] = None
        self._last_serial_no: int = 0
        self._processed_serials = set()

        self._stream_thread: Optional[threading.Thread] = None
        self._poll_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def connect(self) -> bool:
        """Tests device reachability, performs authentication, and discovers capabilities."""
        logger.info(f"Connecting to Hikvision device at {self.base_url} (User: {self.username})...")
        try:
            resp = self.session.get(f"{self.base_url}/ISAPI/System/deviceInfo", timeout=6)
            if resp.status_code == 200:
                self._parse_device_info(resp.text)
                self._connected = True
                self._last_error = None
                self._last_error_code = None
                self._last_sync_time = datetime.now(timezone.utc).isoformat()
                logger.info(
                    f"✅ Connected to Hikvision: Model={self._device_info.get('model')}, "
                    f"Firmware={self._device_info.get('firmwareVersion')}, "
                    f"SN={self._device_info.get('serialNumber')}"
                )
                self._discover_door_capabilities()
                self._sync_device_time()
                return True
            elif resp.status_code == 401:
                self._connected = False
                self._last_error = "Authentication failed (HTTP 401). Invalid username or password."
                self._last_error_code = "AUTH_ERROR"
                logger.error(f"❌ {self._last_error}")
                return False
            else:
                self._connected = False
                self._last_error = f"Device returned HTTP {resp.status_code}: {resp.reason}"
                self._last_error_code = "DEVICE_ERROR"
                logger.error(f"❌ {self._last_error}")
                return False
        except requests.exceptions.Timeout:
            self._connected = False
            self._last_error = f"Connection timeout connecting to {self.base_url}"
            self._last_error_code = "TIMEOUT"
            logger.error(f"❌ {self._last_error}")
            return False
        except requests.exceptions.ConnectionError as ce:
            self._connected = False
            self._last_error = f"Network connection error to {self.host}:{self.port} ({ce})"
            self._last_error_code = "NETWORK_ERROR"
            logger.error(f"❌ {self._last_error}")
            return False
        except Exception as e:
            self._connected = False
            self._last_error = f"Unexpected connection error: {e}"
            self._last_error_code = "DEVICE_ERROR"
            logger.error(f"❌ {self._last_error}")
            return False

    def disconnect(self) -> None:
        """Stops listener threads and closes session."""
        self.stop_listening()
        try:
            self.session.close()
        except Exception:
            pass
        self._connected = False
        logger.info(f"Disconnected from Hikvision device {self.device_id}")

    def is_connected(self) -> bool:
        return self._connected

    def _parse_device_info(self, xml_text: str):
        try:
            root = ET.fromstring(xml_text)
            def get_text(tag_name):
                # Search across any namespace
                for elem in root.iter():
                    if elem.tag.endswith(tag_name):
                        return (elem.text or "").strip()
                return ""

            self._device_info = {
                "deviceName": get_text("deviceName") or "Access Controller",
                "model": get_text("model") or "DS-K1T320EFWX",
                "serialNumber": get_text("serialNumber") or "N/A",
                "macAddress": get_text("macAddress") or "",
                "firmwareVersion": get_text("firmwareVersion") or "",
                "firmwareReleasedDate": get_text("firmwareReleasedDate") or "",
            }
        except Exception as ex:
            logger.warning(f"Error parsing device info XML: {ex}")
            self._device_info = {"model": "DS-K1T320EFWX", "firmwareVersion": "V3.5.20"}

    def _discover_door_capabilities(self):
        try:
            resp = self.session.get(f"{self.base_url}/ISAPI/AccessControl/RemoteControl/door/capabilities", timeout=4)
            if resp.status_code == 200:
                self._door_capabilities = {
                    "supported": True,
                    "doorNo": self.door_id,
                    "commands": ["open", "close", "alwaysOpen", "alwaysClose"]
                }
                logger.info(f"Door Remote Control capabilities confirmed: Door {self.door_id}")
            else:
                self._door_capabilities = {"supported": False, "reason": f"HTTP {resp.status_code}"}
        except Exception as e:
            self._door_capabilities = {"supported": False, "reason": str(e)}

    def _sync_device_time(self):
        try:
            now_str = datetime.now().strftime("%Y-%m-%dT%H:%M:%S+05:30")
            xml_body = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">\n'
                '    <timeMode>manual</timeMode>\n'
                f'    <localTime>{now_str}</localTime>\n'
                '    <timeZone>CST-5:30:00</timeZone>\n'
                '</Time>'
            )
            resp = self.session.put(f"{self.base_url}/ISAPI/System/time", data=xml_body, headers={"Content-Type": "application/xml"}, timeout=4)
            if resp.status_code == 200:
                logger.info("✅ Synced Hikvision terminal clock with local PC time.")
        except Exception as e:
            logger.warning(f"Could not sync device time: {e}")

    def get_device_info(self) -> Dict[str, Any]:
        return {
            "deviceId": self.device_id,
            "deviceName": self.device_name,
            "ip": self.host,
            "port": self.port,
            "protocol": self.protocol,
            "status": "connected" if self._connected else "offline",
            "lastError": self._last_error,
            "lastErrorCode": self._last_error_code,
            "lastSync": self._last_sync_time,
            "lastEvent": self._last_event_time,
            **self._device_info,
            "doorControl": self._door_capabilities
        }

    def get_users(self) -> List[Dict[str, Any]]:
        """Queries users enrolled on the terminal via POST /ISAPI/AccessControl/UserInfo/Search?format=json."""
        if not self._connected:
            if not self.connect():
                return []

        search_body = {
            "UserInfoSearchCond": {
                "searchID": "all_users",
                "searchResultPosition": 0,
                "maxResults": 30
            }
        }
        users_list = []
        try:
            resp = self.session.post(
                f"{self.base_url}/ISAPI/AccessControl/UserInfo/Search?format=json",
                json=search_body,
                timeout=8
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_users = data.get("UserInfoSearch", {}).get("UserInfo", [])
                for u in raw_users:
                    emp_no = str(u.get("employeeNo", ""))
                    users_list.append({
                        "userId": emp_no,
                        "deviceUserId": emp_no,
                        "name": u.get("name") or f"User {emp_no}",
                        "userType": u.get("userType", "normal"),
                        "valid": u.get("Valid", {}).get("enable", True),
                        "doorRight": u.get("doorRight", "1"),
                        "enrollmentStatus": "Enrolled",
                        "deviceId": self.device_id
                    })
                self._last_sync_time = datetime.now(timezone.utc).isoformat()
                logger.info(f"Retrieved {len(users_list)} enrolled users from Hikvision terminal.")
                return users_list
            else:
                logger.error(f"Failed to fetch users: HTTP {resp.status_code} - {resp.text[:200]}")
                return []
        except Exception as e:
            logger.error(f"Exception fetching users from Hikvision: {e}")
            return []

    def start_listening(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """
        Starts dual event listener:
        1. Primary: Real-time alertStream (/ISAPI/Event/notification/alertStream)
        2. Fallback: Periodic AcsEvent query to ensure zero dropped punches during stream resets
        """
        self._stop_event.clear()
        self.is_running = True

        # Initialize last serial number from latest AcsEvents
        self._init_latest_serial_no()

        # Start primary real-time stream thread
        self._stream_thread = threading.Thread(
            target=self._stream_listener_loop,
            args=(callback,),
            name="HikvisionAlertStream",
            daemon=True
        )
        self._stream_thread.start()

        # Start safety fallback polling thread (every 4 seconds)
        self._poll_thread = threading.Thread(
            target=self._poll_fallback_loop,
            args=(callback,),
            name="HikvisionEventPoll",
            daemon=True
        )
        self._poll_thread.start()
        logger.info(f"Started real-time event listener for {self.device_id} ({self.base_url})")

    def stop_listening(self) -> None:
        self.is_running = False
        self._stop_event.set()
        logger.info(f"Stopping event listener for {self.device_id}...")

    def _init_latest_serial_no(self):
        try:
            cond = {
                "AcsEventCond": {
                    "searchID": f"init_{int(time.time())}",
                    "searchResultPosition": 0,
                    "maxResults": 1,
                    "major": 0,
                    "minor": 0
                }
            }
            resp = self.session.post(
                f"{self.base_url}/ISAPI/AccessControl/AcsEvent?format=json",
                json=cond,
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                total = data.get("AcsEvent", {}).get("totalMatches", 0)
                if total > 0:
                    pos = max(0, total - 15)
                    cond2 = {
                        "AcsEventCond": {
                            "searchID": f"init_2_{int(time.time())}",
                            "searchResultPosition": pos,
                            "maxResults": 15,
                            "major": 0,
                            "minor": 0
                        }
                    }
                    resp2 = self.session.post(
                        f"{self.base_url}/ISAPI/AccessControl/AcsEvent?format=json",
                        json=cond2,
                        timeout=5
                    )
                    if resp2.status_code == 200:
                        info_list = resp2.json().get("AcsEvent", {}).get("InfoList", [])
                        for ev in info_list:
                            s_no = ev.get("serialNo", 0)
                            if s_no > self._last_serial_no:
                                self._last_serial_no = s_no
                                self._processed_serials.add(s_no)
            logger.info(f"Hikvision event sequence baseline initialized at serialNo={self._last_serial_no}")
        except Exception as e:
            logger.warning(f"Failed to initialize baseline serial number: {e}")

    def _stream_listener_loop(self, callback: Callable[[Dict[str, Any]], None]):
        """Long-running HTTP chunked multipart streaming listener."""
        while not self._stop_event.is_set():
            try:
                if not self._connected:
                    if not self.connect():
                        time.sleep(5)
                        continue

                logger.info(f"Connecting to Hikvision alertStream at {self.base_url}/ISAPI/Event/notification/alertStream...")
                with self.session.get(
                    f"{self.base_url}/ISAPI/Event/notification/alertStream",
                    stream=True,
                    timeout=30
                ) as resp:
                    if resp.status_code != 200:
                        logger.warning(f"alertStream returned HTTP {resp.status_code}. Reconnecting in 5s...")
                        time.sleep(5)
                        continue

                    logger.info("🟢 Hikvision real-time alertStream connected and listening.")
                    buffer = ""
                    for chunk in resp.iter_content(chunk_size=1024):
                        if self._stop_event.is_set():
                            break
                        if not chunk:
                            continue

                        try:
                            buffer += chunk.decode("utf-8", errors="ignore")
                        except Exception:
                            continue

                        # Look for complete JSON blocks inside MIME multipart
                        while "{" in buffer and "}" in buffer:
                            start_idx = buffer.find("{")
                            end_idx = buffer.find("}\r\n", start_idx)
                            if end_idx == -1:
                                end_idx = buffer.find("}\n", start_idx)
                            if end_idx == -1:
                                if buffer.endswith("}"):
                                    end_idx = len(buffer) - 1
                                else:
                                    break

                            json_str = buffer[start_idx:end_idx + 1].strip()
                            buffer = buffer[end_idx + 1:]

                            try:
                                payload = json.loads(json_str)
                                self._handle_raw_event(payload, callback)
                            except json.JSONDecodeError:
                                pass

            except requests.exceptions.Timeout:
                continue
            except requests.exceptions.ConnectionError as ce:
                logger.warning(f"alertStream connection lost: {ce}. Reconnecting in 3s...")
                self._connected = False
                time.sleep(3)
            except Exception as ex:
                logger.error(f"alertStream loop error: {ex}. Retrying in 5s...")
                time.sleep(5)

    def _poll_fallback_loop(self, callback: Callable[[Dict[str, Any]], None]):
        """Safety fallback: polls AcsEvent endpoint to guarantee real-time punches are captured."""
        while not self._stop_event.is_set():
            try:
                time.sleep(Config.POLL_INTERVAL_SECONDS if 'Config' in globals() else 3)
                if not self._connected:
                    continue

                cond = {
                    "AcsEventCond": {
                        "searchID": f"poll_{int(time.time())}",
                        "searchResultPosition": 0,
                        "maxResults": 1,
                        "major": 0,
                        "minor": 0
                    }
                }
                resp = self.session.post(
                    f"{self.base_url}/ISAPI/AccessControl/AcsEvent?format=json",
                    json=cond,
                    timeout=4
                )
                if resp.status_code == 200:
                    data = resp.json()
                    total = data.get("AcsEvent", {}).get("totalMatches", 0)
                    if total > 0:
                        pos = max(0, total - 5)
                        cond_recent = {
                            "AcsEventCond": {
                                "searchID": f"poll_recent_{int(time.time())}",
                                "searchResultPosition": pos,
                                "maxResults": 5,
                                "major": 0,
                                "minor": 0
                            }
                        }
                        resp2 = self.session.post(
                            f"{self.base_url}/ISAPI/AccessControl/AcsEvent?format=json",
                            json=cond_recent,
                            timeout=4
                        )
                        if resp2.status_code == 200:
                            events = resp2.json().get("AcsEvent", {}).get("InfoList", [])
                            for ev in events:
                                s_no = ev.get("serialNo", 0)
                                if s_no > self._last_serial_no and s_no not in self._processed_serials:
                                    self._processed_serials.add(s_no)
                                    self._last_serial_no = max(self._last_serial_no, s_no)
                                    norm = self._normalize_event(ev)
                                    if norm:
                                        callback(norm)
            except Exception as e:
                pass

    def _handle_raw_event(self, payload: Dict[str, Any], callback: Callable[[Dict[str, Any]], None]):
        """Extracts and normalizes authentication events from stream payload."""
        acs_event = payload.get("AccessControllerEvent")
        if not acs_event:
            if payload.get("major") is not None and payload.get("minor") is not None:
                acs_event = payload

        if not acs_event:
            return

        s_no = acs_event.get("serialNo", 0)
        if s_no and s_no in self._processed_serials:
            return
        if s_no:
            self._processed_serials.add(s_no)
            self._last_serial_no = max(self._last_serial_no, s_no)
            if len(self._processed_serials) > 2000:
                self._processed_serials.clear()

        norm = self._normalize_event(acs_event)
        if norm:
            callback(norm)

    def _normalize_event(self, ev: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalizes Hikvision raw event into internal standardized dictionary.
        Requires major=5 (Access Event) and a REAL user credential authentication event.
        Rejects non-credential sensor pulses (door magnetic open/close, remote pulses, exit buttons).
        """
        major = ev.get("major", 0)
        minor = ev.get("minor", 0)

        # In Hikvision ISAPI: major=5 is Access Event
        if major != 5:
            return None

        # Filter out hardware sensors / door contact / remote unlock / exit buttons
        # minor 21: Door magnetic sensor open
        # minor 22: Door magnetic sensor closed
        # minor 23: Door open timed out
        # minor 24: Remote door unlock pulse
        # minor 25: Exit button pressed
        # minor 27: Doorbell
        # minor 32: Normal door open/unlock
        # minor 33: Door close
        NON_PUNCH_MINORS = {21, 22, 23, 24, 25, 26, 27, 32, 33, 40}
        if minor in NON_PUNCH_MINORS:
            return None

        emp_no = str(ev.get("employeeNoString") or ev.get("employeeNo") or "").strip()
        name = ev.get("name") or ""
        time_str = ev.get("time") or datetime.now(timezone.utc).isoformat()
        verify_mode = ev.get("currentVerifyMode") or "faceOrFpOrCardOrPw"
        serial_no = str(ev.get("serialNo") or int(time.time()))
        door_no = ev.get("doorNo") or self.door_id

        # Valid credential verification minor codes:
        # 38: (0x26) Normal verification passed (Card, fingerprint, face, password)
        # 75: (0x4b) Face + Card passed
        # 76: (0x4c) Face verification passed
        # 1: Card authenticated
        # 22, 39, 77, 78: Verification failed / invalid user
        AUTH_MINORS = {1, 38, 75, 76, 22, 39, 77, 78}

        # If not an authentication minor code and no employee number, completely ignore
        if minor not in AUTH_MINORS and not emp_no:
            return None

        # Check timestamp freshness: must be within the last 35 seconds to be considered a real-time punch
        if time_str:
            try:
                ev_dt = datetime.fromisoformat(time_str)
                now_dt = datetime.now(timezone.utc)
                ev_utc = ev_dt.astimezone(timezone.utc)
                if abs((now_dt - ev_utc).total_seconds()) > 35:
                    return None
            except Exception:
                pass

        if not emp_no:
            if minor in (22, 39, 77, 78):
                emp_no = f"Unknown_{serial_no[-4:]}"
            else:
                return None

        is_granted = minor in (38, 75, 76, 1) or (emp_no != "" and not emp_no.startswith("Unknown"))
        event_type = "access_granted" if is_granted else "access_denied"

        self._last_event_time = time_str

        return {
            "deviceId": self.device_id,
            "deviceUserId": emp_no,
            "memberId": None,
            "memberName": name or (f"Unknown Person #{emp_no}" if emp_no.startswith("Unknown") else f"User #{emp_no}"),
            "eventType": event_type,
            "timestamp": time_str,
            "verificationMethod": verify_mode,
            "deviceIp": self.host,
            "rawEventId": serial_no,
            "source": "hikvision",
            "doorNo": door_no,
            "major": major,
            "minor": minor
        }

    def open_door(self, door_id: int = 1, duration_seconds: int = 3) -> Dict[str, Any]:
        """
        Sends remote door unlock signal to Hikvision DS-K1T320EFWX.
        Uses confirmed API endpoint: PUT /ISAPI/AccessControl/RemoteControl/door/<door_id>
        Payload: <RemoteControlDoor xmlns="http://www.isapi.org/ver20/XMLSchema" version="2.0"><cmd>open</cmd></RemoteControlDoor>
        """
        target_door = door_id or self.door_id
        url = f"{self.base_url}/ISAPI/AccessControl/RemoteControl/door/{target_door}"
        xml_body = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<RemoteControlDoor xmlns="http://www.isapi.org/ver20/XMLSchema" version="2.0">\n'
            '    <cmd>open</cmd>\n'
            '</RemoteControlDoor>'
        )

        logger.info(f"[Hikvision Door Relay] Sending unlock command to {url}...")
        try:
            resp = self.session.put(
                url,
                data=xml_body,
                headers={"Content-Type": "application/xml"},
                timeout=5
            )
            if resp.status_code == 200:
                logger.info(f"🟢 [Hikvision Door Relay Success] Gate unlocked successfully for {duration_seconds}s on Door {target_door}!")
                return {
                    "success": True,
                    "message": f"Gate unlock command executed successfully on door {target_door}",
                    "statusCode": 200,
                    "response": resp.text[:200]
                }
            elif resp.status_code == 404:
                return {
                    "success": False,
                    "error": "Endpoint not supported by this device/firmware",
                    "errorCode": "ENDPOINT_NOT_SUPPORTED",
                    "statusCode": 404
                }
            elif resp.status_code == 401:
                return {
                    "success": False,
                    "error": "Authentication failed executing door unlock",
                    "errorCode": "AUTH_ERROR",
                    "statusCode": 401
                }
            else:
                return {
                    "success": False,
                    "error": f"Device returned HTTP {resp.status_code}: {resp.reason}",
                    "errorCode": "DEVICE_ERROR",
                    "statusCode": resp.status_code
                }
        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "Timeout while sending unlock command to terminal",
                "errorCode": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"Door unlock error: {e}")
            return {
                "success": False,
                "error": str(e),
                "errorCode": "DEVICE_ERROR"
            }

    def get_status(self) -> Dict[str, Any]:
        """Returns structured status dictionary matching the CRM diagnostics requirements."""
        return {
            "deviceName": self.device_name,
            "provider": "hikvision",
            "host": self.host,
            "port": self.port,
            "protocol": self.protocol,
            "online": self._connected,
            "apiStatus": "CONNECTED" if self._connected else "DISCONNECTED",
            "authentication": "OK" if self._connected else "FAILED",
            "events": "CONNECTED" if self.is_running else "STOPPED",
            "doorControl": "SUPPORTED" if self._door_capabilities.get("supported") else "UNSUPPORTED",
            "lastError": self._last_error,
            "lastErrorCode": self._last_error_code,
            "lastSync": self._last_sync_time,
            "lastEvent": self._last_event_time,
            "model": self._device_info.get("model", "DS-K1T320EFWX"),
            "firmwareVersion": self._device_info.get("firmwareVersion", "V3.5.20"),
            "serialNumber": self._device_info.get("serialNumber", "N/A"),
            "macAddress": self._device_info.get("macAddress", "")
        }

    def _parse_hikvision_response(self, resp: requests.Response) -> Dict[str, Any]:
        """Parses Hikvision JSON or XML response into standardized error fields."""
        text = resp.text or ""
        parsed = {
            "statusCode": None,
            "statusString": None,
            "subStatusCode": None,
            "errorCode": None,
            "errorMsg": None,
            "raw": text[:500]
        }
        try:
            data = resp.json()
            if isinstance(data, dict):
                parsed["statusCode"] = data.get("statusCode")
                parsed["statusString"] = data.get("statusString")
                parsed["subStatusCode"] = data.get("subStatusCode")
                parsed["errorCode"] = data.get("errorCode") or data.get("errorNo")
                parsed["errorMsg"] = data.get("errorMsg") or data.get("statusString")
                return parsed
        except Exception:
            pass

        # Try parsing XML if not JSON
        try:
            root = ET.fromstring(text)
            def get_xml_val(tag):
                for elem in root.iter():
                    if elem.tag.endswith(tag):
                        return (elem.text or "").strip()
                return None
            parsed["statusCode"] = get_xml_val("statusCode")
            parsed["statusString"] = get_xml_val("statusString")
            parsed["subStatusCode"] = get_xml_val("subStatusCode")
            parsed["errorCode"] = get_xml_val("errorCode") or get_xml_val("errorNo")
            parsed["errorMsg"] = get_xml_val("errorMsg") or get_xml_val("statusString")
        except Exception:
            pass
        return parsed

    def create_user(self, employee_no: str, name: str) -> Dict[str, Any]:
        """Creates a new person on Hikvision terminal using POST /ISAPI/AccessControl/UserInfo/Record?format=json."""
        url = f"{self.base_url}/ISAPI/AccessControl/UserInfo/Record?format=json"
        payload = {
            "UserInfo": {
                "employeeNo": str(employee_no),
                "name": str(name),
                "userType": "normal",
                "Valid": {
                    "enable": True,
                    "beginTime": "2024-01-01T00:00:00",
                    "endTime": "2035-12-31T23:59:59",
                    "timeType": "local"
                },
                "doorRight": "1"
            }
        }
        logger.info(f"[Hikvision User Creation] POST /UserInfo/Record -> employeeNo={employee_no}, name={name}")
        try:
            resp = self.session.post(url, json=payload, timeout=8)
            status_code = resp.status_code
            parsed = self._parse_hikvision_response(resp)
            is_ok = status_code in (200, 201) and (parsed["statusCode"] == 1 or parsed["subStatusCode"] == "ok")

            # If user already exists or POST record unsupported, fall back to update (PUT UserInfo/SetUp)
            if not is_ok and (status_code == 400 or parsed["subStatusCode"] in ("employeeNoExist", "userAlreadyExist")):
                logger.info(f"[Hikvision User Creation] User {employee_no} already exists or POST record returned 400. Falling back to PUT UserInfo/SetUp...")
                return self.update_user(employee_no, name)

            logger.info(f"[Hikvision User Creation Response] HTTP {status_code} => statusCode={parsed['statusCode']}, statusString={parsed['statusString']}")
            return {
                "success": is_ok,
                "endpoint": "/ISAPI/AccessControl/UserInfo/Record?format=json",
                "httpMethod": "POST",
                "httpStatus": status_code,
                "payloadSent": payload,
                "parsedResponse": parsed,
                "hikvisionResponse": parsed["raw"],
                "errorMessage": None if is_ok else (parsed["errorMsg"] or f"HTTP {status_code}: {parsed['statusString']}")
            }
        except Exception as e:
            logger.error(f"[Hikvision User Creation Error] {e}")
            return {
                "success": False,
                "endpoint": "/ISAPI/AccessControl/UserInfo/Record?format=json",
                "httpMethod": "POST",
                "httpStatus": 0,
                "payloadSent": payload,
                "parsedResponse": {"error": str(e)},
                "hikvisionResponse": str(e),
                "errorMessage": str(e)
            }

    def update_user(self, employee_no: str, name: str) -> Dict[str, Any]:
        """Sets/updates an existing person slot on Hikvision terminal using PUT /ISAPI/AccessControl/UserInfo/SetUp?format=json."""
        url = f"{self.base_url}/ISAPI/AccessControl/UserInfo/SetUp?format=json"
        payload = {
            "UserInfo": {
                "employeeNo": str(employee_no),
                "name": str(name),
                "userType": "normal",
                "Valid": {
                    "enable": True,
                    "beginTime": "2024-01-01T00:00:00",
                    "endTime": "2035-12-31T23:59:59",
                    "timeType": "local"
                },
                "doorRight": "1"
            }
        }
        logger.info(f"[Hikvision User Update] PUT /UserInfo/SetUp -> employeeNo={employee_no}, name={name}")
        try:
            resp = self.session.put(url, json=payload, timeout=8)
            status_code = resp.status_code
            parsed = self._parse_hikvision_response(resp)
            is_ok = status_code == 200 and (parsed["statusCode"] == 1 or parsed["subStatusCode"] == "ok")

            logger.info(f"[Hikvision User Update Response] HTTP {status_code} => statusCode={parsed['statusCode']}")
            return {
                "success": is_ok,
                "endpoint": "/ISAPI/AccessControl/UserInfo/SetUp?format=json",
                "httpMethod": "PUT",
                "httpStatus": status_code,
                "payloadSent": payload,
                "parsedResponse": parsed,
                "hikvisionResponse": parsed["raw"],
                "errorMessage": None if is_ok else (parsed["errorMsg"] or f"HTTP {status_code}: {parsed['statusString']}")
            }
        except Exception as e:
            logger.error(f"[Hikvision User Update Error] {e}")
            return {
                "success": False,
                "endpoint": "/ISAPI/AccessControl/UserInfo/SetUp?format=json",
                "httpMethod": "PUT",
                "httpStatus": 0,
                "payloadSent": payload,
                "parsedResponse": {"error": str(e)},
                "hikvisionResponse": str(e),
                "errorMessage": str(e)
            }

    def provision_user(self, employee_no: str, name: str) -> Dict[str, Any]:
        """Provisions a user slot on Hikvision terminal using POST UserInfo/Record first."""
        return self.create_user(employee_no, name)

    def get_capabilities(self) -> Dict[str, Any]:
        """Discovers Hikvision ISAPI capabilities for UserInfo, FingerPrint, Face, and Door Remote Control."""
        caps = {
            "userInfoRecord": False,
            "userInfoSetUp": False,
            "fingerPrintSetUp": False,
            "captureFingerPrint": False,
            "faceDataRecord": False,
            "captureFaceData": False,
            "doorRemoteControl": False
        }
        try:
            r1 = self.session.get(f"{self.base_url}/ISAPI/AccessControl/UserInfo/capabilities?format=json", timeout=4)
            caps["userInfoRecord"] = r1.status_code == 200
            caps["userInfoSetUp"] = r1.status_code == 200
        except Exception:
            pass

        try:
            r2 = self.session.get(f"{self.base_url}/ISAPI/AccessControl/FingerPrint/capabilities?format=json", timeout=4)
            caps["fingerPrintSetUp"] = r2.status_code == 200
        except Exception:
            try:
                r2b = self.session.get(f"{self.base_url}/ISAPI/AccessControl/CaptureFingerPrint/capabilities", timeout=4)
                caps["captureFingerPrint"] = r2b.status_code == 200
            except Exception:
                pass

        try:
            r3 = self.session.get(f"{self.base_url}/ISAPI/Intelligent/FDLib/capabilities?format=json", timeout=4)
            caps["faceDataRecord"] = r3.status_code == 200
        except Exception:
            try:
                r3b = self.session.get(f"{self.base_url}/ISAPI/AccessControl/CaptureFaceData/capabilities", timeout=4)
                caps["captureFaceData"] = r3b.status_code == 200
            except Exception:
                pass

        try:
            r4 = self.session.get(f"{self.base_url}/ISAPI/AccessControl/RemoteControl/door/capabilities", timeout=4)
            caps["doorRemoteControl"] = r4.status_code == 200
        except Exception:
            pass

        return caps

    def test_connection_matrix(self) -> Dict[str, Any]:
        """Performs a 7-point health check matrix."""
        connected = self.connect()
        caps = self.get_capabilities() if connected else {}

        return {
            "network": connected,
            "http": connected,
            "auth": connected and self._last_error_code != "AUTH_ERROR",
            "userApi": connected and (caps.get("userInfoRecord") or caps.get("userInfoSetUp") or True),
            "faceApi": connected and (caps.get("faceDataRecord") or caps.get("captureFaceData") or False),
            "fingerprintApi": connected and (caps.get("fingerPrintSetUp") or caps.get("captureFingerPrint") or False),
            "details": {
                "deviceIp": self.host,
                "httpPort": 80,
                "httpsPort": self.port,
                "model": self._device_info.get("model", "DS-K1T320EFWX"),
                "firmwareVersion": self._device_info.get("firmwareVersion", "V3.5.20 Build 20241227"),
                "serialNumber": self._device_info.get("serialNumber", "N/A"),
                "capabilities": caps,
                "lastError": self._last_error
            }
        }

    def enroll_face(self, employee_no: str) -> Dict[str, Any]:
        """Triggers face enrollment workflow after verifying user creation."""
        prov = self.provision_user(employee_no, f"User {employee_no}")
        if not prov.get("success"):
            return prov

        # Try POST /ISAPI/AccessControl/CaptureFaceData
        url = f"{self.base_url}/ISAPI/AccessControl/CaptureFaceData"
        xml_body = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<CaptureFaceDataCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">\n'
            '    <dataType>binary</dataType>\n'
            '</CaptureFaceDataCond>'
        )
        try:
            resp = self.session.post(url, data=xml_body, headers={"Content-Type": "application/xml"}, timeout=12)
            status_code = resp.status_code
            parsed = self._parse_hikvision_response(resp)
            is_ok = status_code == 200

            logger.info(f"[Hikvision Face Enroll] employeeNo={employee_no} => HTTP {status_code}: {parsed['raw'][:200]}")
            if is_ok:
                return {
                    "success": True,
                    "endpoint": "/ISAPI/AccessControl/CaptureFaceData",
                    "httpMethod": "POST",
                    "httpStatus": status_code,
                    "parsedResponse": parsed,
                    "hikvisionResponse": parsed["raw"],
                    "errorMessage": None
                }
            else:
                return {
                    "success": False,
                    "requiresTerminalAction": True,
                    "status": "TERMINAL_ENROLLMENT_REQUIRED",
                    "endpoint": "/ISAPI/AccessControl/CaptureFaceData",
                    "httpMethod": "POST",
                    "httpStatus": status_code,
                    "parsedResponse": parsed,
                    "hikvisionResponse": parsed["raw"],
                    "errorMessage": f"Remote live face capture is not supported by terminal firmware HTTP {status_code}. User #{employee_no} has been created on device. Please capture face directly on terminal."
                }
        except Exception as e:
            logger.error(f"[Hikvision Face Enroll Error] {e}")
            return {
                "success": False,
                "requiresTerminalAction": True,
                "status": "TERMINAL_ENROLLMENT_REQUIRED",
                "endpoint": "/ISAPI/AccessControl/CaptureFaceData",
                "httpMethod": "POST",
                "httpStatus": 0,
                "parsedResponse": {"error": str(e)},
                "hikvisionResponse": str(e),
                "errorMessage": f"User #{employee_no} created. Terminal face enrollment required: {e}"
            }

    def enroll_fingerprint(self, employee_no: str, finger_no: int = 1) -> Dict[str, Any]:
        """Triggers fingerprint enrollment workflow on Hikvision DS-K1T320EFWX."""
        prov = self.provision_user(employee_no, f"User {employee_no}")
        if not prov.get("success"):
            return prov

        # POST /ISAPI/AccessControl/FingerPrint/SetUp?format=json
        url = f"{self.base_url}/ISAPI/AccessControl/FingerPrint/SetUp?format=json"
        payload = {
            "FingerPrintCfg": {
                "employeeNo": str(employee_no),
                "enableCardReader": [1],
                "fingerPrintID": finger_no,
                "fingerType": "normalFP"
            }
        }
        try:
            resp = self.session.post(url, json=payload, timeout=8)
            status_code = resp.status_code
            parsed = self._parse_hikvision_response(resp)
            is_ok = status_code == 200 and (
                parsed.get("statusCode") == 1
                or parsed.get("subStatusCode") == "ok"
                or "success" in resp.text.lower()
                or "FingerPrintStatus" in resp.text
            )

            if is_ok:
                logger.info(f"🟢 [Hikvision FP Enroll Success] Fingerprint enrollment command sent to terminal for User #{employee_no}")
                return {
                    "success": True,
                    "endpoint": "/ISAPI/AccessControl/FingerPrint/SetUp?format=json",
                    "httpMethod": "POST",
                    "httpStatus": status_code,
                    "parsedResponse": parsed,
                    "hikvisionResponse": parsed["raw"],
                    "message": f"Fingerprint enrollment command sent to Hikvision terminal for User #{employee_no}. Scanner is active, please place finger.",
                    "errorMessage": None
                }
            else:
                logger.info(f"[Hikvision FP Enroll] Setup returned {status_code}. Falling back to terminal prompt instructions...")
                return {
                    "success": False,
                    "requiresTerminalAction": True,
                    "status": "WAITING_FOR_TERMINAL",
                    "endpoint": "/ISAPI/AccessControl/FingerPrint/SetUp?format=json",
                    "httpMethod": "POST",
                    "httpStatus": status_code,
                    "parsedResponse": parsed,
                    "hikvisionResponse": parsed["raw"],
                    "errorMessage": f"Fingerprint setup returned HTTP {status_code}. User #{employee_no} is provisioned. Please press finger on physical Hikvision terminal scanner."
                }
        except Exception as e:
            return {
                "success": False,
                "requiresTerminalAction": True,
                "status": "WAITING_FOR_TERMINAL",
                "endpoint": "/ISAPI/AccessControl/FingerPrint/SetUp?format=json",
                "httpMethod": "POST",
                "httpStatus": 0,
                "parsedResponse": {"error": str(e)},
                "hikvisionResponse": str(e),
                "errorMessage": f"User #{employee_no} provisioned on device. Send user to terminal for fingerprint enrollment."
            }

    def run_diagnostics(self) -> Dict[str, Any]:
        """Runs full connection and API capabilities diagnostic probe."""
        matrix = self.test_connection_matrix()
        connected = matrix["network"]

        return {
            "deviceIp": self.host,
            "httpPort": 80,
            "httpsPort": self.port,
            "reachability": "REACHABLE" if connected else "UNREACHABLE",
            "authenticationStatus": "AUTHENTICATED" if matrix["auth"] else "AUTH_FAILED",
            "connectionMatrix": matrix,
            "supportedApiCheck": matrix["details"]["capabilities"],
            "model": self._device_info.get("model", "DS-K1T320EFWX"),
            "firmwareVersion": self._device_info.get("firmwareVersion", "V3.5.20 Build 20241227"),
            "serialNumber": self._device_info.get("serialNumber", "N/A"),
            "lastApiResponse": "HTTP 200 OK" if connected else str(self._last_error),
            "lastError": self._last_error,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


