import os
import sys
import time
import signal
import logging
import threading
import uuid
import base64
import requests
from datetime import datetime, timezone, date
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


# ---------------------------------------------------------------------------
# Membership / access policy helpers (same field semantics as the CRM + K90 listener)
# ---------------------------------------------------------------------------
EXPLICIT_BLOCK_STATUSES = {"blocked", "blacklisted", "frozen", "inactive", "suspended", "cancelled", "canceled"}


def parse_membership_date(value):
    if not value:
        return None
    try:
        if hasattr(value, "date") and callable(value.date):
            return value.date()
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value / 1000 if value > 10_000_000_000 else value).date()
        return datetime.strptime(str(value).strip()[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def membership_allows_terminal_access(data, today=None, allow_explicit_unblock=False):
    today = today or date.today()
    statuses = {str(data.get(key, "") or "").strip().casefold() for key in ("status", "membershipStatus")}
    explicit_unblock_pending = allow_explicit_unblock and data.get("biometricBlockPending") is True and data.get("biometricBlockAction") == "unblock"
    if ((data.get("biometricBlocked") is True and not explicit_unblock_pending)
            or data.get("isBlocked") is True or data.get("blacklisted") is True
            or statuses.intersection(EXPLICIT_BLOCK_STATUSES | {"expired"})):
        return False
    start = parse_membership_date(data.get("startDate") or data.get("membershipStartDate") or data.get("joinDate"))
    expiry = parse_membership_date(data.get("expiryDate") or data.get("membershipExpiryDate") or data.get("endDate"))
    if start and today < start:
        return False
    if expiry and today > expiry:
        return False
    return True


def explicitly_blocked(data):
    """True only for admin/CRM blocks. Date windows are enforced by the terminal's own validity period."""
    statuses = {str(data.get(key, "") or "").strip().casefold() for key in ("status", "membershipStatus")}
    return bool(data.get("biometricBlocked") is True or data.get("isBlocked") is True
                or data.get("blacklisted") is True or statuses.intersection(EXPLICIT_BLOCK_STATUSES))


PHOTO_KEYS = ("photoUrl", "photo", "avatarUrl", "avatar", "profilePhotoUrl")


def load_record_photo_bytes(record):
    """Returns JPEG/PNG bytes of the CRM photo, or None when the record has no usable photo."""
    for key in PHOTO_KEYS:
        value = str(record.get(key) or "").strip()
        if not value:
            continue
        try:
            if value.startswith("data:image"):
                return base64.b64decode(value.split(",", 1)[1])
            if value.startswith("http://") or value.startswith("https://"):
                resp = requests.get(value, timeout=20)
                if resp.status_code == 200 and resp.content:
                    return resp.content
        except Exception as exc:
            logger.warning(f"[Sync] Could not load CRM photo ({key}): {exc}")
    return None


def now_iso():
    return datetime.now(timezone.utc).isoformat()


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

        # Register signal handlers for graceful shutdown (SIGTERM from process managers)
        def _signal_handler(signum, frame):
            logger.info(f"[Agent] Received signal {signum} — shutting down gracefully...")
            self.stop()
        try:
            signal.signal(signal.SIGTERM, _signal_handler)
            signal.signal(signal.SIGINT, _signal_handler)
        except Exception:
            pass

        # Keep main thread alive
        try:
            while not self._stop_event.is_set():
                time.sleep(1)
        except (KeyboardInterrupt, SystemExit):
            self.stop()
        except Exception as ex:
            logger.error(f"[Agent] Unexpected error in main loop: {ex}")
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
                if command in self.EXTENDED_COMMANDS:
                    self._dispatch_extended_command(db, command_doc, data)
                    continue
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
                    if face_confirmed:
                        self._apply_enrollment_to_crm(db, command_doc.reference, "face")
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

    # ------------------------------------------------------------------
    # Extended cloud commands (block/unblock, delete, member sync) for Hikvision
    # ------------------------------------------------------------------
    EXTENDED_COMMANDS = ("set_user_access", "delete_biometric", "hikvision_delete_user",
                         "sync_to_device", "hikvision_sync_member")
    _terminal_lock = threading.Lock()

    @staticmethod
    def _target_collection(data):
        target = data.get("targetCollection")
        if target in ("members", "employees"):
            return target
        return "employees" if (data.get("isEmployee") or data.get("targetType") == "EMPLOYEE") else "members"

    def _dispatch_extended_command(self, db, command_doc, data):
        """Claims the command, then runs it in a worker thread so the heartbeat loop never blocks."""
        command = data.get("command")
        command_doc.reference.update({
            "status": "processing",
            "startedAt": now_iso(),
            "updatedAt": now_iso(),
            "processedBy": Config.HIKVISION_DEVICE_ID,
        })
        target = {
            "set_user_access": self._run_set_user_access,
            "delete_biometric": self._run_delete_user,
            "hikvision_delete_user": self._run_delete_user,
            "sync_to_device": self._run_sync_member,
            "hikvision_sync_member": self._run_sync_member,
        }[command]
        threading.Thread(target=target, args=(db, command_doc.reference, data),
                         name=f"HikCmd-{command}-{command_doc.id}", daemon=True).start()

    @staticmethod
    def _finish(ref, status, message, extra=None):
        payload = {"status": status, "message": message, "updatedAt": now_iso()}
        if status == "failed":
            payload["error"] = message
        if extra:
            payload.update(extra)
        try:
            ref.update(payload)
        except Exception as exc:
            logger.warning(f"[Command] Could not write status to {ref.id}: {exc}")

    def _run_set_user_access(self, db, ref, data):
        bio_id = str(data.get("biometricId", "")).strip()
        member_id = str(data.get("memberId", "")).strip()
        name = data.get("memberName") or f"Member {bio_id}"
        enabled = data.get("enabled") is True
        manual = data.get("source") != "membership_policy"
        collection = self._target_collection(data)
        target_ref = db.collection(collection).document(member_id)
        try:
            snap = target_ref.get()
            if not snap.exists:
                raise RuntimeError(f"{collection[:-1].capitalize()} record no longer exists.")
            record = snap.to_dict() or {}
            action = "unblock" if enabled else "block"
            if manual:
                if (record.get("biometricBlockCommandId") != ref.id or record.get("biometricBlockPending") is not True
                        or record.get("biometricBlockAction") != action):
                    return self._finish(ref, "cancelled", "Skipped: superseded by a newer CRM access action.")
                if enabled and not membership_allows_terminal_access(record, allow_explicit_unblock=True):
                    target_ref.set({"biometricBlocked": True, "biometricBlockPending": False, "biometricBlockAction": None}, merge=True)
                    return self._finish(ref, "failed", "Membership is not eligible for access; renew or activate it first.")
            elif membership_allows_terminal_access(record) != bool(enabled):
                return self._finish(ref, "cancelled", "Skipped: superseded by newer membership state.")
            if not self.hikvision_provider or not self.hikvision_provider.is_connected():
                raise RuntimeError("Hikvision terminal is offline.")
            with self._terminal_lock:
                result = self.hikvision_provider.set_user_access(bio_id, bool(enabled))
            if not result.get("success"):
                raise RuntimeError(result.get("errorMessage") or "Terminal rejected the access change.")
            stamp = now_iso()
            update = {
                "biometricEnrolled": bool(result.get("hasFace") or result.get("hasFingerprint")),
                "faceEnrolled": bool(result.get("hasFace")),
                "fingerprintEnrolled": bool(result.get("hasFingerprint")),
                "lastBiometricSync": stamp,
            }
            if manual:
                update.update({
                    "biometricBlocked": not bool(enabled),
                    "biometricBlockPending": False,
                    "biometricBlockAction": None,
                    "biometricBlockCommandId": None,
                    "biometricBlockedAt": None if enabled else stamp,
                    "biometricBlockReason": None if enabled else "Manually blocked from gate control",
                })
            target_ref.set(update, merge=True)
            message = ("Access enabled" if enabled else "Access disabled") + f" for {name}; face/fingerprint templates retained."
            self._finish(ref, "success", message, {"enabled": bool(enabled), "hasFace": bool(result.get("hasFace")),
                                                  "hasFingerprint": bool(result.get("hasFingerprint"))})
            logger.info(f"[ACCESS] {message} (ID {bio_id})")
        except Exception as exc:
            logger.error(f"[ACCESS] Terminal user {bio_id}: {exc}")
            if manual:
                # Fail closed: a failed unblock must never open software-side access.
                try:
                    target_ref.set({"biometricBlocked": True, "biometricBlockPending": False, "biometricBlockAction": None}, merge=True)
                except Exception:
                    pass
            self._finish(ref, "failed", f"Access update failed: {exc}")

    def _run_delete_user(self, db, ref, data):
        bio_id = str(data.get("biometricId", "")).strip()
        member_id = str(data.get("memberId", "")).strip()
        name = data.get("memberName") or f"Member {bio_id}"
        collection = self._target_collection(data)
        try:
            if not self.hikvision_provider or not self.hikvision_provider.is_connected():
                raise RuntimeError("Hikvision terminal is offline.")
            with self._terminal_lock:
                result = self.hikvision_provider.delete_user(bio_id)
            if not result.get("success"):
                raise RuntimeError(result.get("errorMessage") or "Terminal rejected the delete request.")
            stamp = now_iso()
            if member_id:
                db.collection(collection).document(member_id).set({
                    "biometricEnrolled": False,
                    "faceEnrolled": False, "faceStatus": "NOT_ENROLLED", "faceEnrollmentStatus": "NOT_ENROLLED",
                    "fingerprintEnrolled": False, "fingerprintStatus": "not_enrolled", "fingerprintEnrollmentStatus": "NOT_ENROLLED",
                    "biometricSyncStatus": "deleted", "lastBiometricSync": stamp,
                }, merge=True)
                db.collection("biometric_profiles").document(member_id).set(
                    {"fingerprintStatus": "not_enrolled", "deletedAt": stamp}, merge=True)
            self._finish(ref, "success", f"Biometric data deleted for {name}")
            logger.info(f"[Enrollment] Deleted terminal user {bio_id} ({name})")
        except Exception as exc:
            logger.error(f"[Enrollment] Delete failed for {bio_id}: {exc}")
            self._finish(ref, "failed", f"Delete failed: {exc}")

    def _run_sync_member(self, db, ref, data):
        """Server-side provisioning: user + membership validity + CRM photo as face. Never needs the UI."""
        bio_id = str(data.get("biometricId", "")).strip()
        member_id = str(data.get("memberId", "")).strip()
        collection = self._target_collection(data)
        target_ref = db.collection(collection).document(member_id) if member_id else None

        def mark_record(status, error=None, extra=None):
            if not target_ref:
                return
            payload = {"biometricSyncStatus": status, "biometricSyncError": error, "biometricSyncCommandId": ref.id}
            if status == "synced":
                payload["biometricSyncedAt"] = now_iso()
            if extra:
                payload.update(extra)
            try:
                target_ref.set(payload, merge=True)
            except Exception as exc:
                logger.warning(f"[Sync] Could not update CRM record {collection}/{member_id}: {exc}")

        try:
            if not bio_id.isdigit():
                raise RuntimeError("A numeric biometric ID is required.")
            record = {}
            if target_ref:
                snap = target_ref.get()
                if not snap.exists:
                    raise RuntimeError(f"{collection[:-1].capitalize()} record no longer exists.")
                record = snap.to_dict() or {}
            name = str(record.get("name") or data.get("memberName") or f"Member {bio_id}").strip()
            if not self.hikvision_provider or not self.hikvision_provider.is_connected():
                raise RuntimeError("Hikvision terminal is offline; the command will stay failed until retried.")
            is_employee = collection == "employees"
            # Terminal validity stays wide open (2024..2035) exactly like before; membership expiry is
            # enforced by CRM policy / access blocks, so a renewal can never lock a paying member out.
            begin = None
            end = None
            enabled = not explicitly_blocked(record)
            with self._terminal_lock:
                result = self.hikvision_provider.upsert_user(bio_id, name, enabled=enabled, begin=begin, end=end)
                if not result.get("success"):
                    raise RuntimeError(result.get("errorMessage") or "Terminal rejected user creation.")
                status = self.hikvision_provider.get_user_biometric_status(bio_id)
                has_face = bool(status.get("hasFace"))
                has_fp = bool(status.get("hasFingerprint"))
                face_note = ""
                if not has_face and record.get("photoSource") != "HIKVISION":
                    photo = load_record_photo_bytes(record)
                    if photo:
                        pushed = self.hikvision_provider.push_face_photo(bio_id, photo)
                        has_face = bool(pushed.get("success"))
                        if not has_face:
                            face_note = f" Face photo not accepted: {pushed.get('errorMessage')}"
                    else:
                        face_note = " No CRM photo available for face; enroll face at the terminal."
            stamp = now_iso()
            flags = {
                "biometricEnrolled": has_face or has_fp,
                "faceEnrolled": has_face,
                "faceStatus": "ENROLLED" if has_face else "NOT_ENROLLED",
                "faceEnrollmentStatus": "ENROLLED" if has_face else "PENDING",
                "fingerprintEnrolled": has_fp,
                "fingerprintStatus": "ENROLLED" if has_fp else "NOT_ENROLLED",
                "fingerprintEnrollmentStatus": "ENROLLED" if has_fp else "PENDING",
                "biometricDeviceId": Config.HIKVISION_DEVICE_ID,
                "lastBiometricSync": stamp,
            }
            if has_face:
                flags["faceEnrolledAt"] = stamp
            mark_record("synced", None, flags)
            message = (f"{name} synced to Hikvision (ID {bio_id}); face={'yes' if has_face else 'no'}, "
                       f"fingerprint={'yes' if has_fp else 'pending at terminal'}.{face_note}")
            self._finish(ref, "success", message, {"hasFace": has_face, "hasFingerprint": has_fp,
                                                  "userCreated": bool(result.get("created"))})
            logger.info(f"[Sync] {message}")
        except Exception as exc:
            logger.error(f"[Sync] Member sync failed for ID {bio_id}: {exc}")
            mark_record("failed", str(exc))
            self._finish(ref, "failed", f"Sync failed: {exc}")

    def _apply_enrollment_to_crm(self, db, command_ref, kind):
        """After the terminal confirms a template, set the CRM flags the dashboard reads."""
        try:
            data = command_ref.get().to_dict() or {}
            member_id = str(data.get("memberId") or "").strip()
            if not member_id or member_id.startswith("new_"):
                return
            collection = self._target_collection(data)
            stamp = now_iso()
            update = {"biometricEnrolled": True, "lastBiometricSync": stamp}
            if kind == "face":
                update.update({"faceEnrolled": True, "faceStatus": "ENROLLED",
                               "faceEnrollmentStatus": "ENROLLED", "faceEnrolledAt": stamp})
            else:
                update.update({"fingerprintEnrolled": True, "fingerprintStatus": "ENROLLED",
                               "fingerprintEnrollmentStatus": "ENROLLED", "fingerprintEnrolledAt": stamp})
            doc_ref = db.collection(collection).document(member_id)
            if doc_ref.get().exists:
                doc_ref.set(update, merge=True)
                command_ref.update({"crmUpdated": True, "updatedAt": now_iso()})
        except Exception as exc:
            logger.warning(f"[Remote Enrollment] Could not update CRM flags: {exc}")

    def _watch_biometric_enrollment(self, command_ref, bio_id, command):
        """Verify saved templates against the actual terminal after it accepts a capture command."""
        expected = "face" if command == "hikvision_enroll_face" else "fingerprint"
        db = self.processor.db
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
                    self._apply_enrollment_to_crm(db, command_ref, expected)
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
