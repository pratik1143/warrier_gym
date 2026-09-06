import time
import logging
import threading
from datetime import datetime, timezone
from typing import Callable, Dict, Any, List, Optional

from .biometric_provider import BiometricProvider

logger = logging.getLogger("ESSLProvider")

class ESSLProvider(BiometricProvider):
    """
    ESSL / ZKTeco Biometric Provider (e.g. ESSL K90 Pro).
    Wraps pyzk into the BiometricProvider interface to preserve full backward compatibility.
    """

    def __init__(
        self,
        device_id: str = "dev_k90_main",
        device_name: str = "ESSL K90 Pro",
        host: str = "192.168.18.11",
        port: int = 4370
    ):
        super().__init__(device_id, device_name, host, port)
        self._zk = None
        self._conn = None
        self._connected = False
        self._last_error = None
        self._last_sync_time = None
        self._last_event_time = None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

    def connect(self) -> bool:
        try:
            from zk import ZK
            self._zk = ZK(self.host, port=self.port, timeout=5)
            with self._lock:
                self._conn = self._zk.connect()
                self._connected = True
                self._last_error = None
                self._last_sync_time = datetime.now(timezone.utc).isoformat()
                logger.info(f"✅ Connected to ESSL device at {self.host}:{self.port}")
                return True
        except Exception as e:
            self._connected = False
            self._last_error = str(e)
            logger.warning(f"Failed to connect to ESSL device at {self.host}:{self.port}: {e}")
            return False

    def disconnect(self) -> None:
        self.stop_listening()
        with self._lock:
            if self._conn:
                try:
                    self._conn.disconnect()
                except Exception:
                    pass
                self._conn = None
        self._connected = False

    def is_connected(self) -> bool:
        return self._connected

    def get_device_info(self) -> Dict[str, Any]:
        fw, sn, dev_name = "Unknown", "Unknown", self.device_name
        if self._conn:
            try:
                fw = self._conn.get_firmware_version()
                sn = self._conn.get_serialnumber()
                dev_name = self._conn.get_device_name() or self.device_name
            except Exception:
                pass
        return {
            "deviceId": self.device_id,
            "deviceName": dev_name,
            "ip": self.host,
            "port": self.port,
            "status": "connected" if self._connected else "offline",
            "firmwareVersion": fw,
            "serialNumber": sn,
            "lastError": self._last_error,
            "lastSync": self._last_sync_time,
            "lastEvent": self._last_event_time
        }

    def get_users(self) -> List[Dict[str, Any]]:
        users_list = []
        if not self._conn and not self.connect():
            return []
        try:
            with self._lock:
                users = self._conn.get_users()
                for u in users:
                    users_list.append({
                        "userId": str(u.user_id),
                        "deviceUserId": str(u.user_id),
                        "name": u.name or f"User {u.user_id}",
                        "privilege": u.privilege,
                        "card": u.card or "",
                        "enrollmentStatus": "Enrolled",
                        "deviceId": self.device_id
                    })
                self._last_sync_time = datetime.now(timezone.utc).isoformat()
            return users_list
        except Exception as e:
            logger.error(f"Error reading users from ESSL: {e}")
            return []

    def start_listening(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        self._stop_event.clear()
        self.is_running = True

        def listener_loop():
            while not self._stop_event.is_set():
                try:
                    if not self._connected:
                        if not self.connect():
                            time.sleep(5)
                            continue

                    logger.info("Starting ESSL live capture stream...")
                    for attendance in self._conn.live_capture():
                        if self._stop_event.is_set():
                            break
                        if attendance is None:
                            continue

                        user_id = str(attendance.user_id)
                        ts = attendance.timestamp.isoformat() + "Z" if attendance.timestamp else datetime.now(timezone.utc).isoformat()
                        self._last_event_time = ts

                        normalized = {
                            "deviceId": self.device_id,
                            "deviceUserId": user_id,
                            "memberId": None,
                            "memberName": "",
                            "eventType": "access_granted",
                            "timestamp": ts,
                            "verificationMethod": "biometric",
                            "deviceIp": self.host,
                            "rawEventId": f"{user_id}_{int(time.time())}",
                            "source": "essl"
                        }
                        callback(normalized)

                except Exception as ex:
                    logger.warning(f"ESSL listener loop exception: {ex}. Reconnecting in 5s...")
                    self._connected = False
                    time.sleep(5)

        thread = threading.Thread(target=listener_loop, name="ESSLListener", daemon=True)
        thread.start()

    def stop_listening(self) -> None:
        self.is_running = False
        self._stop_event.set()

    def open_door(self, door_id: int = 1, duration_seconds: int = 3) -> Dict[str, Any]:
        if not self._conn and not self.connect():
            return {"success": False, "error": "Cannot connect to ESSL device"}
        try:
            with self._lock:
                self._conn.unlock(duration_seconds * 10)
            return {"success": True, "message": f"ESSL gate opened for {duration_seconds}s"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_status(self) -> Dict[str, Any]:
        return {
            "deviceName": self.device_name,
            "provider": "essl",
            "host": self.host,
            "port": self.port,
            "online": self._connected,
            "apiStatus": "CONNECTED" if self._connected else "DISCONNECTED",
            "lastError": self._last_error,
            "lastSync": self._last_sync_time,
            "lastEvent": self._last_event_time
        }
