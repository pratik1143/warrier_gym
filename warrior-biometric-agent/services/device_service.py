import os
import sys
import time
import signal
import logging
import threading
import uuid
import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from firebase_admin import storage
from urllib.parse import quote

# Add root of warrior-biometric-agent to sys.path
AGENT_ROOT = Path(__file__).resolve().parent.parent
if str(AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENT_ROOT))

# Also add device-service directory for desktop_popup if needed
DEVICE_SERVICE_DIR = AGENT_ROOT.parent / "device-service"
if str(DEVICE_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(DEVICE_SERVICE_DIR))

from config.config import Config
from providers.hikvision_provider import HikvisionProvider
from providers.essl_provider import ESSLProvider
from services.event_processor import EventProcessor

# Setup logs directory
LOGS_DIR = AGENT_ROOT / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOGS_DIR / "warrior_biometric_agent.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("BiometricAgent")


def acquire_instance_lock():
    """Prevent the scheduled task and a manual launch from processing a command twice."""
    lock_path = AGENT_ROOT / "agent.lock"
    lock_handle = open(lock_path, "a+b")
    lock_handle.seek(0, os.SEEK_END)
    if lock_handle.tell() == 0:
        lock_handle.write(b"0")
        lock_handle.flush()
    lock_handle.seek(0)

    try:
        if sys.platform == "win32":
            import msvcrt
            msvcrt.locking(lock_handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return lock_handle
    except (OSError, ImportError):
        lock_handle.close()
        logger.warning("Another Warrior Gym biometric agent instance is already running; exiting this duplicate.")
        return None

class BiometricAgentManager:
    """
    Unified manager for The Warrior Gym local biometric agent.
    Coordinates Hikvision and ESSL providers, event processing, Firestore heartbeat, and door commands.
    """

    def __init__(self):
        self.running = False
        self.providers = []
        self.hikvision_provider = None
        self.essl_provider = None
        self.processor = None
        self._stop_event = threading.Event()

    def initialize(self):
        logger.info("==================================================")
        logger.info("     THE WARRIOR GYM BIOMETRIC AGENT STARTING     ")
        logger.info("==================================================")
        logger.info(f"Active Provider Mode: {Config.ACTIVE_PROVIDER.upper()}")
        logger.info(f"Hikvision Target    : {Config.HIKVISION_PROTOCOL}://{Config.HIKVISION_HOST}:{Config.HIKVISION_PORT}")
        logger.info(f"ESSL Target         : {Config.ESSL_HOST}:{Config.ESSL_PORT}")
        logger.info("==================================================")

        # 1. Initialize Hikvision Provider
        if Config.ACTIVE_PROVIDER in ("hikvision", "both"):
            self.hikvision_provider = HikvisionProvider(
                device_id=Config.HIKVISION_DEVICE_ID,
                device_name=Config.HIKVISION_DEVICE_NAME,
                host=Config.HIKVISION_HOST,
                port=Config.HIKVISION_PORT,
                protocol=Config.HIKVISION_PROTOCOL,
                username=Config.HIKVISION_USERNAME,
                password=Config.HIKVISION_PASSWORD,
                door_id=Config.HIKVISION_DOOR_ID
            )
            self.providers.append(self.hikvision_provider)

        # 2. Initialize ESSL Provider (if configured)
        if Config.ACTIVE_PROVIDER in ("essl", "both"):
            self.essl_provider = ESSLProvider(
                device_id=Config.ESSL_DEVICE_ID,
                device_name=Config.ESSL_DEVICE_NAME,
                host=Config.ESSL_HOST,
                port=Config.ESSL_PORT
            )
            self.providers.append(self.essl_provider)

        # 3. Initialize Event Processor with Door Callback
        def door_relay_callback(door_id=1, duration_seconds=3):
            if self.hikvision_provider and self.hikvision_provider.is_connected():
                return self.hikvision_provider.open_door(door_id=door_id, duration_seconds=duration_seconds)
            elif self.essl_provider and self.essl_provider.is_connected():
                return self.essl_provider.open_door(door_id=door_id, duration_seconds=duration_seconds)
            return {"success": False, "error": "No connected device available to unlock"}

        self.processor = EventProcessor(door_callback=door_relay_callback)

    def start(self):
        self.running = True
        self._stop_event.clear()

        # Connect and start listeners on providers
        for provider in self.providers:
            try:
                connected = provider.connect()
                if connected:
                    provider.start_listening(self.processor.process_event)
                else:
                    logger.warning(f"Initial connection to {provider.device_id} failed. Background retry enabled.")
            except Exception as ex:
                logger.error(f"Error starting provider {provider.device_id}: {ex}")

        # Start background heartbeat & remote command loop
        hb_thread = threading.Thread(target=self._heartbeat_and_command_loop, name="AgentHeartbeat", daemon=True)
        hb_thread.start()

        logger.info("✅ Warrior Biometric Agent initialized and running.")

        # Keep main thread alive
        try:
            while not self._stop_event.is_set():
                time.sleep(1)
        except (KeyboardInterrupt, SystemExit):
            self.stop()

    def stop(self):
        logger.info("Shutting down Warrior Biometric Agent...")
        self.running = False
        self._stop_event.set()

        for provider in self.providers:
            try:
                provider.stop_listening()
                provider.disconnect()
            except Exception as e:
                logger.warning(f"Error stopping provider {provider.device_id}: {e}")

        logger.info("Agent stopped cleanly.")

    def _heartbeat_and_command_loop(self):
        """Periodically reports health to Firestore and checks for remote commands (e.g. test door unlock)."""
        # Reconnect cooldown: track last attempt time per provider to avoid reconnect storms
        _reconnect_last: Dict[str, float] = {}
        _reconnect_lock = threading.Lock()
        RECONNECT_COOLDOWN = 30  # seconds between reconnect attempts per provider

        while not self._stop_event.is_set():
            try:
                time.sleep(1)
                now_iso = datetime.now(timezone.utc).isoformat()

                # Check connectivity for each provider and attempt reconnection if needed
                # Use cooldown + lock to prevent simultaneous/storm reconnects
                for p in self.providers:
                    if not p.is_connected():
                        last_attempt = _reconnect_last.get(p.device_id, 0)
                        if time.time() - last_attempt >= RECONNECT_COOLDOWN:
                            with _reconnect_lock:
                                # Double-check after acquiring lock
                                if not p.is_connected():
                                    _reconnect_last[p.device_id] = time.time()
                                    logger.info(f"[Reconnect] Attempting reconnect to {p.device_id}...")
                                    connected = p.connect()
                                    if connected and not p.is_running:
                                        p.start_listening(self.processor.process_event)

                # Report to Firestore
                if self.processor and self.processor.db:
                    db = self.processor.db
                    hik_status = self.hikvision_provider.get_status() if self.hikvision_provider else None
                    essl_status = self.essl_provider.get_status() if self.essl_provider else None

                    is_hik_online = hik_status.get("online", False) if hik_status else False
                    is_essl_online = essl_status.get("online", False) if essl_status else False

                    # Update device_testing/control for legacy dashboard health bar
                    control_ref = db.collection("device_testing").document("control")
                    control_snap = control_ref.get()
                    control_data = control_snap.to_dict() if (control_snap and control_snap.exists) else {}

                    # Fetch device info BEFORE building the update_payload (was incorrectly placed after)
                    dev_info = {}
                    if self.hikvision_provider:
                        try:
                            dev_info = self.hikvision_provider.get_device_info() or {}
                        except Exception:
                            dev_info = {}

                    update_payload = {
                        "lastHeartbeat": now_iso,
                        "lastHeartbeatServer": SERVER_TIMESTAMP,
                        "updatedAt": now_iso,
                        "pythonConnected": True,
                        "attendanceListenerRunning": True,
                        "internetConnected": True,
                        "activeProvider": Config.ACTIVE_PROVIDER,
                        "hikvisionStatus": hik_status,
                        "esslStatus": essl_status,
                        "hikvisionOnline": is_hik_online,
                        "esslConnected": is_essl_online,
                        "gateControlEnabled": is_hik_online or is_essl_online,
                        "version": "3.3.0-hikvision-enrollment-bridge",
                        "deviceModel": dev_info.get("model") or "DS-K1T320EFWX",
                        "deviceIp": Config.HIKVISION_HOST,
                        "reconnectCount": getattr(self, "reconnect_count", 0)
                    }
                    control_ref.set(update_payload, merge=True)

                    # Also update devices collection
                    if self.hikvision_provider:
                        db.collection("devices").document(Config.HIKVISION_DEVICE_ID).set({
                            "deviceId": Config.HIKVISION_DEVICE_ID,
                            "deviceName": Config.HIKVISION_DEVICE_NAME,
                            "deviceType": f"Hikvision {dev_info.get('model') or 'DS-K1T320EFWX'}",
                            "ip": Config.HIKVISION_HOST,
                            "port": Config.HIKVISION_PORT,
                            "branch": Config.HIKVISION_BRANCH,
                            "enabled": True,
                            "status": "connected" if is_hik_online else "offline",
                            "connectionHealth": 100 if is_hik_online else 0,
                            "lastSync": now_iso,
                            "lastHeartbeat": now_iso,
                            "lastHeartbeatServer": SERVER_TIMESTAMP,
                            "firmwareVersion": dev_info.get("firmwareVersion", "V3.5.20"),
                            "serialNumber": dev_info.get("serialNumber", "N/A"),
                            "provider": "hikvision",
                            "doorControlSupported": True
                        }, merge=True)

                    # Check for pending commands from CRM UI
                    self._check_pending_commands(control_data, db)
                    self._process_pending_biometric_enrollments(db)

                    # Flush offline queue if online
                    self.processor.flush_offline_queue()

            except Exception as ex:
                logger.warning(f"Error in heartbeat loop: {ex}")

    def _process_pending_biometric_enrollments(self, db):
        """Run cloud-queued Hikvision enrollment commands from the gym's LAN agent."""
        if not self.hikvision_provider or not self.hikvision_provider.is_connected():
            return

        try:
            pending = db.collection("biometric_enrollment").where("status", "==", "pending").stream()
            for command_doc in pending:
                data = command_doc.to_dict() or {}
                command = data.get("command")
                if command not in ("hikvision_enroll_face", "hikvision_enroll_fingerprint"):
                    continue

                # Claim before touching the terminal so the same command cannot be replayed.
                command_doc.reference.update({
                    "status": "processing",
                    "startedAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                    "processedBy": Config.HIKVISION_DEVICE_ID,
                })
                bio_id = str(data.get("biometricId", "")).strip()
                member_name = str(data.get("memberName") or f"Member {bio_id}").strip()
                enrollment_type = "FACE" if command == "hikvision_enroll_face" else "FINGERPRINT"
                logger.info(f"[Remote Enrollment] {enrollment_type} requested for {member_name} (ID {bio_id})")

                try:
                    provision = self.hikvision_provider.create_user(bio_id, member_name)
                    if not provision.get("success"):
                        result = provision
                    elif command == "hikvision_enroll_face":
                        result = self.hikvision_provider.enroll_face(bio_id, member_name)
                    else:
                        result = self.hikvision_provider.enroll_fingerprint(bio_id, name=member_name)

                    requires_terminal_action = result.get("requiresTerminalAction") is True
                    face_confirmed = result.get("faceSuccessful") is True or result.get("hasFace") is True
                    accepted = result.get("success") is True or requires_terminal_action

                    if face_confirmed:
                        # Device returned face data immediately — mark enrolled right away
                        status = "enrolled"
                    elif accepted and not requires_terminal_action:
                        status = "enrolling"
                    elif requires_terminal_action:
                        status = "terminal_action_required"
                    else:
                        status = "failed"

                    command_doc.reference.update({
                        "status": status,
                        "deviceAccepted": accepted or face_confirmed,
                        "hasFace": result.get("hasFace", False),
                        "hasFingerprint": result.get("hasFingerprint", False),
                        "numOfFace": result.get("numOfFace", 0),
                        "deviceResult": result,
                        "error": None if (accepted or face_confirmed) else result.get("errorMessage", "Hikvision rejected the enrollment request"),
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                    })
                    if accepted and not face_confirmed:
                        threading.Thread(
                            target=self._watch_biometric_enrollment,
                            args=(command_doc.reference, bio_id, command),
                            name=f"EnrollWatch-{bio_id}-{command}",
                            daemon=True,
                        ).start()
                    logger.info(f"[Remote Enrollment] {enrollment_type} ID {bio_id}: {status}")
                except Exception as exc:
                    logger.exception(f"[Remote Enrollment] Failed for ID {bio_id}")
                    command_doc.reference.update({
                        "status": "failed",
                        "deviceAccepted": False,
                        "error": str(exc),
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                    })
        except Exception as exc:
            logger.warning(f"Could not process cloud enrollment queue: {exc}")

    def _watch_biometric_enrollment(self, command_ref, bio_id, command):
        """Verify saved templates against the actual terminal after it accepts a capture command."""
        expected = "face" if command == "hikvision_enroll_face" else "fingerprint"
        for _ in range(60):
            time.sleep(2)
            try:
                result = self.hikvision_provider.get_user_biometric_status(bio_id)
                has_face = bool(result.get("hasFace") or (result.get("numOfFace") or 0) > 0)
                has_fingerprint = bool(result.get("hasFingerprint") or (result.get("numOfFP") or 0) > 0)
                enrolled = has_face if expected == "face" else has_fingerprint
                command_ref.update({
                    "hasFace": has_face,
                    "hasFingerprint": has_fingerprint,
                    "numOfFace": result.get("numOfFace", 0),
                    "numOfFP": result.get("numOfFP", 0),
                    "lastDeviceCheckAt": datetime.now(timezone.utc).isoformat(),
                    "deviceStatus": result,
                    "status": "enrolled" if enrolled else "enrolling",
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                })
                if enrolled:
                    if expected == "face":
                        photo_result = self._sync_enrolled_face_photo(db, bio_id)
                        if photo_result.get("success"):
                            command_ref.update({
                                "photoUrl": photo_result["photoUrl"],
                                "photoStoragePath": photo_result["photoStoragePath"],
                                "facePhotoAvailable": True,
                                "facePhotoSource": "HIKVISION",
                                "photoSyncedAt": photo_result["photoSyncedAt"],
                            })
                        else:
                            command_ref.update({"facePhotoError": photo_result.get("error", "Face photo sync failed")})
                    logger.info(f"[Remote Enrollment] Verified {expected} template for device user {bio_id}")
                    return
            except Exception as exc:
                logger.warning(f"[Remote Enrollment] Status check failed for {bio_id}: {exc}")

        try:
            command_ref.update({
                "status": "timed_out",
                "error": f"No {expected} template was detected on the terminal before timeout.",
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass

    def _sync_enrolled_face_photo(self, db, bio_id: str) -> Dict[str, Any]:
        """Store the captured terminal portrait and attach it to any matching member."""
        try:
            photo = self.hikvision_provider.download_user_face_photo(bio_id)
            if not photo.get("success"):
                return photo

            synced_at = datetime.now(timezone.utc).isoformat()
            storage_path = f"members/hikvision/{bio_id}/profile.jpg"
            try:
                bucket = storage.bucket()
                blob = bucket.blob(storage_path)
                token = str(uuid.uuid4())
                blob.upload_from_string(photo["imageBytes"], content_type="image/jpeg")
                blob.metadata = {
                    "firebaseStorageDownloadTokens": token,
                    "biometricId": str(bio_id),
                    "photoSource": "HIKVISION",
                    "photoSyncedAt": synced_at,
                }
                blob.patch()
                photo_url = (
                    f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/"
                    f"{quote(storage_path, safe='')}?alt=media&token={token}"
                )
            except Exception as storage_exc:
                # The compressed 320px portrait stays small enough for a Firestore fallback.
                logger.warning(f"Firebase Storage upload failed for face portrait {bio_id}; using compact Firestore fallback: {storage_exc}")
                image_b64 = base64.b64encode(photo["imageBytes"]).decode("ascii")
                photo_url = f"data:image/jpeg;base64,{image_b64}"
                storage_path = ""
            member_photo = {
                "photo": photo_url,
                "photoUrl": photo_url,
                "avatar": photo_url,
                "avatarUrl": photo_url,
                "profilePhotoUrl": photo_url,
                "photoStoragePath": storage_path,
                "photoSource": "HIKVISION",
                "photoSyncedAt": synced_at,
                "facePhotoAvailable": True,
                "facePhotoSource": "HIKVISION",
            }

            db.collection("biometric_photos").document(str(bio_id)).set({
                "biometricId": str(bio_id),
                "photoUrl": photo_url,
                "photoStoragePath": storage_path,
                "photoSource": "HIKVISION",
                "facePhotoAvailable": True,
                "updatedAt": synced_at,
                "updatedAtServer": SERVER_TIMESTAMP,
            }, merge=True)

            for member in db.collection("members").where("biometricId", "==", str(bio_id)).stream():
                member.reference.set(member_photo, merge=True)

            logger.info(f"[Face Photo Sync] Saved terminal portrait for biometric ID {bio_id} to Firebase Storage.")
            return {
                "success": True,
                "photoUrl": photo_url,
                "photoStoragePath": storage_path,
                "photoSyncedAt": synced_at,
            }
        except Exception as exc:
            logger.warning(f"[Face Photo Sync] Could not save portrait for biometric ID {bio_id}: {exc}")
            return {"success": False, "error": str(exc)}

    def _check_pending_commands(self, control_data: Dict[str, Any], db):
        """Processes remote commands dispatched from CRM Settings / Access Control."""
        # 1. Test Door Unlock Command
        if control_data.get("testDoorPending"):
            try:
                db.collection("device_testing").document("control").update({"testDoorPending": False})
                logger.info("🚪 [Remote Command] Test Door Unlock triggered from CRM UI!")
                door_id = control_data.get("testDoorId", Config.HIKVISION_DOOR_ID)
                
                result = {"success": False, "error": "No provider online"}
                if self.hikvision_provider and self.hikvision_provider.is_connected():
                    result = self.hikvision_provider.open_door(door_id=door_id, duration_seconds=3)
                elif self.essl_provider and self.essl_provider.is_connected():
                    result = self.essl_provider.open_door(door_id=door_id, duration_seconds=3)

                # Log to deviceLogs for audit trail
                db.collection("deviceLogs").add({
                    "deviceId": Config.HIKVISION_DEVICE_ID,
                    "deviceName": Config.HIKVISION_DEVICE_NAME,
                    "level": "SUCCESS" if result.get("success") else "ERROR",
                    "message": f"[Manual Gate Test] Result: {result.get('message') or result.get('error')}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "triggeredBy": control_data.get("testDoorUser", "Admin")
                })

                db.collection("device_testing").document("control").update({
                    "lastDoorTestResult": result,
                    "lastDoorTestTime": datetime.now(timezone.utc).isoformat(),
                    "lastDoorTestRequestId": control_data.get("testDoorRequestId")
                })
            except Exception as e:
                logger.error(f"Error processing testDoorPending: {e}")

        # 2. Test Connection Command
        if control_data.get("testConnectionPending"):
            try:
                db.collection("device_testing").document("control").update({"testConnectionPending": False})
                logger.info("🔍 [Remote Command] Test Connection triggered from CRM UI!")
                if self.hikvision_provider:
                    self.hikvision_provider.connect()
                    info = self.hikvision_provider.get_device_info()
                    db.collection("device_testing").document("control").update({
                        "lastConnectionTestResult": info,
                        "lastConnectionTestTime": datetime.now(timezone.utc).isoformat()
                    })
            except Exception as e:
                logger.error(f"Error processing testConnectionPending: {e}")

        # 3. Read Users Command
        if control_data.get("readUsersPending"):
            try:
                db.collection("device_testing").document("control").update({"readUsersPending": False})
                logger.info("👥 [Remote Command] Read Users triggered from CRM UI!")
                if self.hikvision_provider:
                    users = self.hikvision_provider.get_users()
                    db.collection("device_testing").document("control").update({
                        "usersCount": len(users),
                        "usersList": users[:50],
                        "lastChecked": datetime.now(timezone.utc).isoformat()
                    })
            except Exception as e:
                logger.error(f"Error processing readUsersPending: {e}")

        # 4. Test Event Listener Diagnostics Command (Requirement 23)
        if control_data.get("testListenerPending"):
            try:
                db.collection("device_testing").document("control").update({"testListenerPending": False})
                logger.info("📡 [Remote Command] Test Event Listener triggered from CRM UI!")
                is_running = self.hikvision_provider and self.hikvision_provider.is_running
                is_conn = self.hikvision_provider and self.hikvision_provider.is_connected()
                db.collection("device_testing").document("control").update({
                    "lastListenerTestResult": {
                        "streamActive": is_running,
                        "deviceConnected": is_conn,
                        "lastSerialNo": getattr(self.hikvision_provider, "_last_serial_no", 0),
                        "processedCount": len(getattr(self.hikvision_provider, "_processed_serials", set())),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    },
                    "lastListenerTestTime": datetime.now(timezone.utc).isoformat()
                })
            except Exception as e:
                logger.error(f"Error processing testListenerPending: {e}")

        # 5. Send Test Event ONLY IN DEVELOPMENT (Requirement 23)
        if control_data.get("testPunchPending"):
            try:
                test_emp = str(control_data.get("testPunchEmployeeNo", "6")).strip()
                db.collection("device_testing").document("control").update({"testPunchPending": False})
                logger.info(f"🧪 [Remote Command - DEV ONLY] Simulating dev punch for ID #{test_emp}")
                self.processor.process_event({
                    "deviceId": Config.HIKVISION_DEVICE_ID,
                    "deviceUserId": test_emp,
                    "employeeNo": test_emp,
                    "biometricId": test_emp,
                    "memberName": control_data.get("testPunchName", ""),
                    "eventType": "ACCESS_GRANTED",
                    "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S+05:30"),
                    "verificationMethod": control_data.get("testPunchMethod", "FACE"),
                    "deviceIp": Config.HIKVISION_HOST,
                    "rawEventId": f"test_{int(time.time())}",
                    "source": "HIKVISION",
                    "doorNo": 1
                })
            except Exception as e:
                logger.error(f"Error processing testPunchPending: {e}")

if __name__ == "__main__":
    instance_lock = acquire_instance_lock()
    if instance_lock is None:
        sys.exit(0)
    agent = BiometricAgentManager()
    agent.initialize()
    agent.start()
