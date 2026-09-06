import os
import sys
import time
import signal
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

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
        while not self._stop_event.is_set():
            try:
                time.sleep(5)
                now_iso = datetime.now(timezone.utc).isoformat()

                # Check connectivity for each provider and attempt reconnection if needed
                for p in self.providers:
                    if not p.is_connected():
                        p.connect()
                        if p.is_connected() and not p.is_running:
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

                    update_payload = {
                        "lastHeartbeat": now_iso,
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
                        "version": "3.0.0-hikvision"
                    }
                    control_ref.set(update_payload, merge=True)

                    # Also update devices collection
                    if self.hikvision_provider:
                        dev_info = self.hikvision_provider.get_device_info()
                        db.collection("devices").document(Config.HIKVISION_DEVICE_ID).set({
                            "deviceId": Config.HIKVISION_DEVICE_ID,
                            "deviceName": Config.HIKVISION_DEVICE_NAME,
                            "deviceType": "Hikvision DS-K1T320EFWX",
                            "ip": Config.HIKVISION_HOST,
                            "port": Config.HIKVISION_PORT,
                            "branch": Config.HIKVISION_BRANCH,
                            "enabled": True,
                            "status": "connected" if is_hik_online else "offline",
                            "connectionHealth": 100 if is_hik_online else 0,
                            "lastSync": now_iso,
                            "firmwareVersion": dev_info.get("firmwareVersion", "V3.5.20"),
                            "serialNumber": dev_info.get("serialNumber", "N/A"),
                            "provider": "hikvision",
                            "doorControlSupported": True
                        }, merge=True)

                    # Check for pending commands from CRM UI
                    self._check_pending_commands(control_data, db)

                    # Flush offline queue if online
                    self.processor.flush_offline_queue()

            except Exception as ex:
                logger.warning(f"Error in heartbeat loop: {ex}")

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
                    "lastDoorTestTime": datetime.now(timezone.utc).isoformat()
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

if __name__ == "__main__":
    agent = BiometricAgentManager()
    agent.initialize()
    agent.start()
