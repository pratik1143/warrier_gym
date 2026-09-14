import os
import sys
import time
import json
import logging
import threading
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, Optional

import firebase_admin
from firebase_admin import credentials, firestore

from config.config import Config

logger = logging.getLogger("EventProcessor")

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Import desktop popup if available
try:
    # Look in local dir or device-service dir
    if (BASE_DIR / "desktop_popup.py").exists():
        import desktop_popup
    elif (BASE_DIR.parent / "device-service" / "desktop_popup.py").exists():
        sys.path.insert(0, str(BASE_DIR.parent / "device-service"))
        import desktop_popup
    else:
        desktop_popup = None
except Exception as pe:
    logger.warning(f"Could not load desktop_popup: {pe}")
    desktop_popup = None

class EventProcessor:
    """
    Processes normalized biometric events:
    - Stable member identification (deviceUserId + deviceId -> memberId)
    - Membership status & validity verification
    - Idempotency & duplicate punch protection
    - Members Inside (+1 once only) & gym_presence synchronization
    - Authorized door relay activation
    - Offline queueing and automatic sync
    - Desktop overlay popup for reception
    """

    def __init__(self, door_callback=None):
        self.door_callback = door_callback
        self.db = None
        self._init_firebase()
        self.processed_fingerprints = set()
        self.recent_punches = {}  # memberId -> timestamp
        self.unmapped_users = {}   # deviceUserId -> { lastSeen, count, name, deviceId }
        self._load_unmapped_users()

    def _init_firebase(self):
        cert_path = Config.resolve_firebase_credentials()
        if cert_path:
            try:
                # Check if already initialized by this app
                if not firebase_admin._apps:
                    cred = credentials.Certificate(str(cert_path))
                    firebase_admin.initialize_app(cred)
                self.db = firestore.client()
                logger.info(f"✅ Firebase initialized with certificate at {cert_path}")
            except Exception as e:
                logger.error(f"Failed to initialize Firebase: {e}")
                self.db = None
        else:
            logger.warning("⚠ No serviceAccountKey.json found. Operating in local offline queue mode.")

    def _load_unmapped_users(self):
        if self.db is None:
            return
        try:
            docs = self.db.collection("unmapped_device_users").stream()
            for d in docs:
                data = d.to_dict()
                dev_uid = str(d.id)
                self.unmapped_users[dev_uid] = data
        except Exception as e:
            logger.warning(f"Failed to pre-load unmapped users: {e}")

    def process_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main entry point for incoming normalized biometric events.
        Expected event format:
        {
            "deviceId": str,
            "deviceUserId": str,
            "memberId": Optional[str],
            "memberName": str,
            "eventType": "access_granted" | "access_denied",
            "timestamp": str (ISO),
            "verificationMethod": str,
            "deviceIp": str,
            "rawEventId": str,
            "source": "hikvision" | "essl",
            "doorNo": int
        }
        """
        device_id = event.get("deviceId", "unknown_device")
        device_uid = str(event.get("deviceUserId", "")).strip()
        raw_event_id = str(event.get("rawEventId", ""))
        timestamp_iso = event.get("timestamp") or datetime.now(timezone.utc).isoformat()
        device_name = "The Warrior Gym Entrance"
        branch = "The Warrior Gym Main Branch"

        if not device_uid:
            logger.warning(f"Ignoring event with empty deviceUserId: {event}")
            return {"status": "ignored", "reason": "empty_user_id"}

        # 1. Deterministic Idempotency Check using device_id + device_uid + raw_event_id
        event_id = f"punch_{device_id}_{device_uid}_{raw_event_id}"
        fingerprint = f"{device_id}_{device_uid}_{raw_event_id}_{timestamp_iso[:16]}"
        if event_id in self.processed_fingerprints or fingerprint in self.processed_fingerprints:
            logger.info(f"⏭ [Idempotent Protection] Ignoring duplicate raw event {event_id}")
            return {"status": "duplicate_event", "eventId": event_id}

        self.processed_fingerprints.add(event_id)
        self.processed_fingerprints.add(fingerprint)
        if len(self.processed_fingerprints) > 5000:
            self.processed_fingerprints.clear()

        # 2. Member Resolution (STABLE MAPPING ONLY - BY BIOMETRIC / EMPLOYEE ID)
        member = self._resolve_member(device_uid, device_id)

        # 3. Handle Unknown / Unmapped User
        if not member:
            return self._handle_unmapped_user(event, device_uid, device_id, timestamp_iso, event_id)

        # 4. Member Status & Access Evaluation
        member_id = member.get("id") or member.get("uid")
        member_name = member.get("name") or event.get("memberName") or f"Member #{device_uid}"
        member_code = member.get("memberId") or f"TWG-2026-{device_uid}"
        plan_name = member.get("plan") or "Monthly Standard"
        photo_url = member.get("photoUrl") or member.get("photo") or member.get("avatar") or member.get("avatarUrl") or ""
        m_status = str(member.get("status", "active")).strip().upper()

        is_hold = (m_status == "HOLD")
        if is_hold:
            access_status = "hold"
            reason = "Member account is on HOLD"
            days_left = 0
            expired_days = 0
        else:
            access_status, reason, days_left, expired_days = self._evaluate_member_access(member, timestamp_iso)

        # 5. Duplicate Check-in / Already Inside Check (Preserves 1 Members Inside rule)
        is_already_inside = False
        first_checkin_time = ""
        presence_ref = None

        if self.db is not None and access_status == "granted" and not is_hold:
            try:
                presence_ref = self.db.collection("gym_presence").document(member_id)
                presence_snap = presence_ref.get()
                if presence_snap.exists:
                    p_data = presence_snap.to_dict() or {}
                    if p_data.get("inside") is True:
                        is_already_inside = True
                        first_checkin_time = p_data.get("entryTime") or ""
                        reason = "Member is already inside gym"
            except Exception as ex:
                logger.warning(f"Error checking gym_presence for {member_id}: {ex}")

        # Determine Punch Status & Punch Type
        if is_hold:
            punch_status = "HOLD_MEMBER"
            punch_type = "PUNCH_IN"
            gate_will_open = False
        elif is_already_inside:
            punch_status = "ALREADY_INSIDE"
            punch_type = "REPEAT_TAP"
            gate_will_open = False
        elif access_status == "granted":
            punch_status = "MATCHED"
            punch_type = "PUNCH_IN"
            gate_will_open = True
        else:
            punch_status = access_status.upper()
            punch_type = "PUNCH_IN"
            gate_will_open = False

        verification_mode = event.get("verificationMethod", "FACE")

        # 6. CRITICAL (Requirements 11 & 15): Store Raw Device Event FIRST in attendanceEvents
        raw_event_record = {
            "eventId": event_id,
            "deviceId": device_id,
            "hikvisionEventId": raw_event_id,
            "employeeNo": device_uid,
            "biometricId": device_uid,
            "memberId": member_id,
            "memberName": member_name,
            "memberPhotoUrl": photo_url,
            "eventType": "ACCESS_GRANTED" if (punch_status in ("MATCHED", "ALREADY_INSIDE")) else "ACCESS_DENIED",
            "punchType": punch_type,
            "verificationMode": verification_mode,
            "eventTime": timestamp_iso,
            "receivedAt": datetime.now(timezone.utc).isoformat(),
            "status": punch_status,
            "reason": reason,
            "source": "HIKVISION",
            "createdAt": datetime.now(timezone.utc).isoformat()
        }

        if self.db is not None:
            try:
                # Production raw event collection
                self.db.collection("attendanceEvents").document(event_id).set(raw_event_record)
                # Also mirror to attendance_logs for legacy widgets
                self.db.collection("attendance_logs").document(event_id).set(raw_event_record)
                # Realtime latest punch for global dashboard listeners
                self.db.collection("device_testing").document("control").set({
                    "latestPunch": raw_event_record,
                    "lastHeartbeat": datetime.now(timezone.utc).isoformat()
                }, merge=True)
            except Exception as dbe:
                logger.error(f"Error persisting punch event to Firestore: {dbe}")

        logger.info(f"📋 [HIKVISION EVENT RECEIVED] device={device_id} employeeNo={device_uid} eventTime={timestamp_iso} verificationMode={verification_mode}")
        logger.info(f"🔍 [HIKVISION EVENT MAPPED] employeeNo={device_uid} biometricId={device_uid} memberId={member_id} memberName={member_name} status={punch_status}")
        logger.info(f"💾 [FIRESTORE EVENT CREATED] collection=attendanceEvents eventId={event_id}")
        logger.info(f"📢 [LIVE EVENT PUBLISHED] status={punch_status} name={member_name} verificationMode={verification_mode}")

        # 7. Attendance Session & Gym Presence Processing
        today_str = datetime.now().strftime("%Y-%m-%d")
        att_doc_id = f"att_{member_id}_{today_str}"
        punch_record = {
            "docId": att_doc_id,
            "attendanceId": att_doc_id,
            "fingerprint": fingerprint,
            "memberId": member_id,
            "biometricId": device_uid,
            "deviceUserId": device_uid,
            "memberName": member_name,
            "memberCode": member_code,
            "avatarUrl": photo_url,
            "deviceId": device_id,
            "deviceName": device_name,
            "branch": branch,
            "timestamp": timestamp_iso,
            "checkIn": timestamp_iso,
            "checkOut": None,
            "status": punch_status,
            "reason": reason,
            "method": f"Hikvision Biometric ({verification_mode})",
            "membership": plan_name,
            "createdAt": timestamp_iso,
            "rawEventId": raw_event_id,
            "source": "HIKVISION"
        }

        if punch_status == "MATCHED":
            # Fresh Check-in: Increment Members Inside (+1), set 1-hour auto-checkout
            self._save_fresh_checkin(punch_record, member_id, member_name, timestamp_iso, presence_ref)
        elif punch_status == "ALREADY_INSIDE":
            # Repeat tap: DOES NOT increment Members Inside again!
            self._handle_duplicate_inside_punch(punch_record, member_id, member_name, timestamp_iso, presence_ref)
        elif is_hold:
            logger.info(f"⏸ [HOLD Member Punch] {member_name} (ID: {device_uid}) punched. Preserving HOLD status, gate locked.")
        else:
            self._record_denied_attempt(punch_record, member_id)

        # 8. Physical Gate / Door Relay Activation (ONLY FOR AUTHORIZED MEMBERS)
        if gate_will_open:
            logger.info(f"🟢 [Access Granted] Triggering door relay unlock for {member_name} (ID: {device_uid})")
            if self.door_callback:
                try:
                    self.door_callback(door_id=event.get("doorNo", 1), duration_seconds=3)
                except Exception as de:
                    logger.error(f"Error executing door relay callback: {de}")
        else:
            logger.info(f"🔒 [Gate Kept Locked] Access status: {punch_status} for {member_name} ({reason})")

        # 9. Trigger Windows Desktop Overlay Popup
        if desktop_popup:
            try:
                desktop_popup.show_attendance_popup({
                    "status": "granted" if punch_status == "MATCHED" else punch_status.lower(),
                    "memberName": member_name,
                    "memberId": member_id,
                    "memberCode": member_code,
                    "plan": plan_name,
                    "daysRemaining": days_left if punch_status in ("MATCHED", "ALREADY_INSIDE") else 0,
                    "expiredDays": expired_days,
                    "visitCount": member.get("attendanceCount", 1) or 1,
                    "avatarUrl": photo_url,
                    "deviceId": device_name,
                    "biometricId": device_uid,
                    "timestamp": timestamp_iso,
                    "firstCheckInTime": first_checkin_time,
                    "currentPunchTime": timestamp_iso
                })
            except Exception as pe:
                logger.error(f"Desktop popup error: {pe}")

        return {
            "status": punch_status,
            "memberId": member_id,
            "memberName": member_name,
            "gateOpened": gate_will_open,
            "timestamp": timestamp_iso
        }

    def _resolve_member(self, device_uid: str, device_id: str) -> Optional[Dict[str, Any]]:
        """
        Resolves member strictly by deviceUserId / biometricId / employeeId mapping.
        Never guesses by name or phone alone (Requirement 8).
        """
        if self.db is None:
            return None

        clean_uid = str(device_uid).strip().lower()
        if not clean_uid or clean_uid.startswith("unknown"):
            return None

        members_ref = self.db.collection("members")

        try:
            # 1. Exact query on biometricId (string)
            q1 = members_ref.where("biometricId", "==", device_uid).limit(1).stream()
            for doc in q1:
                return {"id": doc.id, **doc.to_dict()}

            # 2. Exact query on employeeId (string)
            q_emp = members_ref.where("employeeId", "==", device_uid).limit(1).stream()
            for doc in q_emp:
                return {"id": doc.id, **doc.to_dict()}

            # 3. Exact query on deviceUserId (string)
            q2 = members_ref.where("deviceUserId", "==", device_uid).limit(1).stream()
            for doc in q2:
                return {"id": doc.id, **doc.to_dict()}

            # 4. Try integer conversion for biometricId / employeeId / deviceUserId
            try:
                int_uid = int(device_uid)
                q3 = members_ref.where("biometricId", "==", int_uid).limit(1).stream()
                for doc in q3:
                    return {"id": doc.id, **doc.to_dict()}

                q_emp_int = members_ref.where("employeeId", "==", int_uid).limit(1).stream()
                for doc in q_emp_int:
                    return {"id": doc.id, **doc.to_dict()}

                q4 = members_ref.where("deviceUserId", "==", int_uid).limit(1).stream()
                for doc in q4:
                    return {"id": doc.id, **doc.to_dict()}
            except ValueError:
                pass

            # 5. Check nested biometric object: biometric.deviceUserId == clean_uid
            q5 = members_ref.where("biometric.deviceUserId", "==", device_uid).limit(1).stream()
            for doc in q5:
                return {"id": doc.id, **doc.to_dict()}

            # 6. In-memory check for exact match or leading zero match across all members
            all_members = [ {"id": d.id, **d.to_dict()} for d in members_ref.stream() ]
            for m in all_members:
                b_id = str(m.get("biometricId", "")).strip().lower()
                e_id = str(m.get("employeeId", "")).strip().lower()
                d_id = str(m.get("deviceUserId", "")).strip().lower()
                h_id = str(m.get("hikvisionUserId", "")).strip().lower()
                nested_bio = m.get("biometric", {})
                nested_dev_uid = str(nested_bio.get("deviceUserId", "")).strip().lower() if isinstance(nested_bio, dict) else ""

                if b_id and (b_id == clean_uid or b_id.lstrip("0") == clean_uid.lstrip("0")):
                    return m
                if e_id and (e_id == clean_uid or e_id.lstrip("0") == clean_uid.lstrip("0")):
                    return m
                if d_id and (d_id == clean_uid or d_id.lstrip("0") == clean_uid.lstrip("0")):
                    return m
                if h_id and (h_id == clean_uid or h_id.lstrip("0") == clean_uid.lstrip("0")):
                    return m
                if nested_dev_uid and (nested_dev_uid == clean_uid or nested_dev_uid.lstrip("0") == clean_uid.lstrip("0")):
                    return m

        except Exception as ex:
            logger.error(f"Error querying member in Firestore: {ex}")

        return None

    def _handle_unmapped_user(self, event: Dict[str, Any], device_uid: str, device_id: str, timestamp_iso: str, event_id: str = "") -> Dict[str, Any]:
        """
        Handles authentication from an unmapped or unknown person (Requirement 9).
        Never silently discards the punch! Persists to attendanceEvents and fires Live Punch popup.
        """
        raw_event_id = str(event.get("rawEventId", ""))
        verification_mode = event.get("verificationMethod", "FACE")
        if not event_id:
            event_id = f"punch_{device_id}_{device_uid}_{raw_event_id}"

        logger.warning(f"⚠️ [UNKNOWN PUNCH DETECTED] Biometric ID #{device_uid} at {device_id} is not mapped in CRM!")

        raw_event_record = {
            "eventId": event_id,
            "deviceId": device_id,
            "hikvisionEventId": raw_event_id,
            "employeeNo": device_uid,
            "biometricId": device_uid,
            "memberId": None,
            "memberName": event.get("memberName") or f"Unknown Person #{device_uid}",
            "memberPhotoUrl": "",
            "eventType": "ACCESS_DENIED",
            "punchType": "UNKNOWN_PUNCH",
            "verificationMode": verification_mode,
            "eventTime": timestamp_iso,
            "receivedAt": datetime.now(timezone.utc).isoformat(),
            "status": "UNKNOWN",
            "reason": "Biometric ID not mapped in CRM",
            "source": "HIKVISION",
            "createdAt": datetime.now(timezone.utc).isoformat()
        }

        unmapped_record = {
            "deviceUserId": device_uid,
            "deviceId": device_id,
            "nameOnDevice": event.get("memberName") or "",
            "lastSeen": timestamp_iso,
            "rawEventId": raw_event_id,
            "verificationMethod": verification_mode,
            "source": "HIKVISION",
            "count": self.unmapped_users.get(device_uid, {}).get("count", 0) + 1
        }
        self.unmapped_users[device_uid] = unmapped_record

        # Store in Firestore collection attendanceEvents (Requirement 11)
        if self.db is not None:
            try:
                self.db.collection("attendanceEvents").document(event_id).set(raw_event_record)
                self.db.collection("attendance_logs").document(event_id).set(raw_event_record)
                self.db.collection("unmapped_device_users").document(f"{device_id}_{device_uid}").set(unmapped_record, merge=True)
                self.db.collection("device_testing").document("control").set({
                    "latestPunch": raw_event_record,
                    "lastHeartbeat": datetime.now(timezone.utc).isoformat()
                }, merge=True)
            except Exception as e:
                logger.error(f"Failed to record unmapped device user in Firestore: {e}")

        logger.info(f"📋 [HIKVISION EVENT RECEIVED] device={device_id} employeeNo={device_uid} status=UNKNOWN")
        logger.info(f"💾 [FIRESTORE EVENT CREATED] collection=attendanceEvents eventId={event_id}")
        logger.info(f"📢 [LIVE EVENT PUBLISHED] status=UNKNOWN biometricId={device_uid}")

        # Desktop popup for front desk alert
        if desktop_popup:
            try:
                desktop_popup.show_attendance_popup({
                    "status": "unknown",
                    "memberName": f"Unknown Person #{device_uid}",
                    "memberId": "",
                    "memberCode": f"Biometric #{device_uid}",
                    "plan": "Unmapped Biometric User",
                    "daysRemaining": 0,
                    "expiredDays": 0,
                    "visitCount": 0,
                    "avatarUrl": "",
                    "deviceId": device_id,
                    "biometricId": device_uid,
                    "timestamp": timestamp_iso,
                    "firstCheckInTime": "",
                    "currentPunchTime": timestamp_iso
                })
            except Exception:
                pass

        return {
            "status": "UNKNOWN",
            "deviceUserId": device_uid,
            "biometricId": device_uid,
            "gateOpened": False,
            "message": f"Biometric ID #{device_uid} is unknown. Gate remains closed."
        }

    def _evaluate_member_access(self, member: Dict[str, Any], timestamp_iso: str):
        today_date = date.today()
        days_left = 30
        expired_days = 0
        status = "granted"
        reason = ""

        # Check explicit status
        m_status = str(member.get("status", "active")).lower()
        if m_status == "hold":
            return "hold", "Member account is on HOLD", 0, 0
        if m_status == "frozen":
            return "frozen", "Membership is frozen", 0, 0
        if m_status == "expired":
            return "expired", "Membership has expired", 0, 1
        if m_status == "blocked":
            return "blocked", "Member account is blocked", 0, 0

        # Check future start date
        start_date_str = member.get("startDate") or member.get("joinDate")
        if start_date_str:
            try:
                s_dt = datetime.strptime(start_date_str[:10], "%Y-%m-%d").date()
                if s_dt > today_date:
                    delta = (s_dt - today_date).days
                    return "denied", f"Membership starts on {start_date_str} (in {delta} days)", 0, 0
            except Exception:
                pass

        # Check expiry date
        exp_date_str = member.get("expiryDate")
        if exp_date_str:
            try:
                exp_dt = datetime.strptime(exp_date_str[:10], "%Y-%m-%d").date()
                diff = (exp_dt - today_date).days
                if diff < 0:
                    expired_days = abs(diff)
                    return "expired", f"Membership expired {expired_days} days ago", 0, expired_days
                else:
                    days_left = diff
            except Exception:
                pass

        return status, reason, days_left, expired_days

    def _save_fresh_checkin(self, punch_record: Dict[str, Any], member_id: str, member_name: str, timestamp_iso: str, presence_ref):
        """Saves a fresh check-in: increments Members Inside (+1), sets 1-hour expected exit."""
        check_in_time = timestamp_iso
        expected_exit = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

        if self.db is not None:
            try:
                # 1. Update gym_presence (Members Inside)
                presence_data = {
                    "memberId": member_id,
                    "memberName": member_name,
                    "inside": True,
                    "entryTime": check_in_time,
                    "expectedExit": expected_exit,
                    "lastPunch": check_in_time,
                    "branch": punch_record.get("branch"),
                    "deviceId": punch_record.get("deviceId")
                }
                if presence_ref:
                    presence_ref.set(presence_data)
                else:
                    self.db.collection("gym_presence").document(member_id).set(presence_data)

                # 2. Write attendance session
                self.db.collection("attendance").document(punch_record["docId"]).set(punch_record, merge=True)

                # 3. Write real-time log
                log_id = f"log_{punch_record['deviceId']}_{punch_record['deviceUserId']}_{int(time.time())}"
                self.db.collection("attendance_logs").document(log_id).set(punch_record)

                # 4. Write punch history
                self.db.collection("punch_history").add({
                    "memberId": member_id,
                    "memberName": member_name,
                    "deviceId": punch_record["deviceId"],
                    "branchId": punch_record["branch"],
                    "punchTime": check_in_time,
                    "punchType": punch_record["method"],
                    "isDuplicatePunch": False,
                    "isInside": True,
                    "source": punch_record.get("source", "hikvision")
                })

                # 5. Increment Member attendance counters
                self.db.collection("members").document(member_id).update({
                    "attendanceCount": firestore.Increment(1),
                    "lastCheckIn": check_in_time
                })

                logger.info(f"✅ [Fresh Check-In Saved] {member_name} marked inside. Expected auto-checkout: {expected_exit}")
            except Exception as e:
                logger.error(f"Error saving fresh check-in to Firestore: {e}. Queuing locally...")
                self._queue_offline_punch(punch_record)
        else:
            self._queue_offline_punch(punch_record)

    def _handle_duplicate_inside_punch(self, punch_record: Dict[str, Any], member_id: str, member_name: str, timestamp_iso: str, presence_ref):
        """
        Handles second or repeated punch while member is already inside.
        - DOES NOT increment Members Inside again!
        - If punch occurs >= 10 mins after entry, treats as manual check-out.
        - Otherwise updates lastPunch time on existing session.
        """
        if self.db is None:
            return

        try:
            doc_snap = presence_ref.get() if presence_ref else None
            p_data = doc_snap.to_dict() if (doc_snap and doc_snap.exists) else {}
            entry_time_str = p_data.get("entryTime") or ""

            should_checkout = False
            if entry_time_str:
                try:
                    entry_dt = datetime.fromisoformat(entry_time_str.replace("Z", "+00:00"))
                    curr_dt = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00"))
                    diff_mins = (curr_dt - entry_dt).total_seconds() / 60.0
                    if diff_mins >= 10:
                        should_checkout = True
                except Exception:
                    pass

            if should_checkout:
                # Checkout punch
                presence_ref.update({
                    "inside": False,
                    "exitTime": timestamp_iso
                })
                punch_record["checkOut"] = timestamp_iso
                punch_record["status"] = "completed"
                self.db.collection("attendance").document(punch_record["docId"]).update({
                    "checkOut": timestamp_iso,
                    "status": "completed",
                    "updatedAt": timestamp_iso
                })
                self.db.collection("attendance_logs").add(punch_record)
                logger.info(f"🚪 [Checkout Recorded] Member {member_name} checked out of gym.")
            else:
                # Immediate duplicate tap (e.g. within 10 minutes of entry):
                # Update lastPunch only, do NOT change inside state, do NOT increment inside count
                presence_ref.update({"lastPunch": timestamp_iso})
                self.db.collection("attendance_logs").add({
                    **punch_record,
                    "status": "duplicate",
                    "note": "Repeat punch while already inside"
                })
                logger.info(f"🔵 [Repeat Tap Ignored] {member_name} is already inside. Members Inside NOT incremented.")

        except Exception as e:
            logger.error(f"Error handling duplicate inside punch: {e}")

    def _record_denied_attempt(self, punch_record: Dict[str, Any], member_id: str):
        if self.db is not None:
            try:
                self.db.collection("attendance_logs").add(punch_record)
            except Exception:
                pass

    def _queue_offline_punch(self, punch_record: Dict[str, Any]):
        try:
            queue = []
            if Config.OFFLINE_QUEUE_FILE.exists():
                with open(Config.OFFLINE_QUEUE_FILE, "r", encoding="utf-8") as f:
                    queue = json.load(f)
            queue.append(punch_record)
            with open(Config.OFFLINE_QUEUE_FILE, "w", encoding="utf-8") as f:
                json.dump(queue, f, indent=2)
            logger.info(f"💾 Saved punch locally in offline queue: {punch_record.get('memberName')}")
        except Exception as e:
            logger.error(f"Failed to queue offline punch: {e}")

    def flush_offline_queue(self):
        if self.db is None or not Config.OFFLINE_QUEUE_FILE.exists():
            return
        try:
            with open(Config.OFFLINE_QUEUE_FILE, "r", encoding="utf-8") as f:
                queue = json.load(f)
            if not queue:
                return

            remaining = []
            synced = 0
            for item in queue:
                try:
                    self.db.collection("attendance").document(item["docId"]).set(item, merge=True)
                    self.db.collection("attendance_logs").add(item)
                    synced += 1
                except Exception:
                    remaining.append(item)

            with open(Config.OFFLINE_QUEUE_FILE, "w", encoding="utf-8") as f:
                json.dump(remaining, f, indent=2)

            if synced > 0:
                logger.info(f"✅ Flushed {synced} offline punches to Firebase! ({len(remaining)} remaining)")
        except Exception as e:
            logger.error(f"Error flushing offline queue: {e}")
