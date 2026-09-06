import os
import sys
import time
import socket
import logging
from datetime import datetime
import threading
from zk import ZK, const
from zk.exception import ZKError
import firebase_admin
from firebase_admin import credentials, firestore

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "warrior_gym_device_tester.log"

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

# Firebase Certificate Resolution
def resolve_service_account_path():
    env_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)
    candidates = [
        BASE_DIR / "serviceAccountKey.json",
        BASE_DIR.parent / "backend" / "serviceAccountKey.json",
        BASE_DIR.parent / "serviceAccountKey.json",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None

SERVICE_ACCOUNT_PATH = resolve_service_account_path()
db = None
if SERVICE_ACCOUNT_PATH:
    try:
        cred = credentials.Certificate(str(SERVICE_ACCOUNT_PATH))
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        logging.info(f"[Tester Init] Firebase Admin SDK initialized using certificate: {SERVICE_ACCOUNT_PATH}")
    except Exception as e:
        logging.error(f"[Tester Init] Failed to initialize Firebase Admin: {e}")

DEVICE_IP = "192.168.18.11"
DEVICE_PORT = 4370
device_status = "Disconnected"
last_sync_time = None

def check_tcp_connection(ip, port):
    """Handshakes with the IP/port over raw TCP socket."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.0)
        s.connect((ip, int(port)))
        s.close()
        return True
    except Exception:
        return False

def push_test_log(log_type, message):
    """Pushes a log message to the Firestore device_testing console logs."""
    try:
        doc_ref = db.collection('device_testing').document('control')
        doc_ref.update({
            'testLogs': firestore.ArrayUnion([f"[{datetime.now().strftime('%H:%M:%S')}] [{log_type}] {message}"])
        })
    except Exception as e:
        logging.error(f"Failed to push test log: {e}")

def run_test_connection():
    """
    FUNCTION 1 & 7: Test Device Connection and log results.
    """
    global device_status
    start_time = datetime.now()
    logging.info(f"Initiating TCP connection test to {DEVICE_IP}:{DEVICE_PORT}...")
    push_test_log("INFO", f"Initiating TCP connection test to {DEVICE_IP}:{DEVICE_PORT}...")
    
    is_up = check_tcp_connection(DEVICE_IP, DEVICE_PORT)
    duration = (datetime.now() - start_time).total_seconds()
    
    if is_up:
        device_status = "Connected"
        msg = f"Connection SUCCESS. Device is reachable on socket. Time elapsed: {duration:.2f}s."
        logging.info(f"[Connection Success] {msg}")
        push_test_log("SUCCESS", msg)
        
        # Try fetching ZK metadata (FUNCTION 2)
        run_read_info()
    else:
        device_status = "Disconnected"
        msg = f"Connection FAILED. Host is unreachable at {DEVICE_IP}:{DEVICE_PORT}."
        logging.error(f"[Connection Failed] {msg}")
        push_test_log("ERROR", msg)
        
        # Write disconnected test result in Firestore
        write_firebase_test_record("Disconnected", "ESSL K90 Pro", 0, 0)
        
    # Update status in Firestore
    db.collection('device_testing').document('control').update({
        'status': device_status,
        'connectionTime': f"{duration:.2f}s",
        'lastChecked': datetime.utcnow().isoformat() + 'Z'
    })

def run_read_info():
    """
    FUNCTION 2: Read Device Information (Name, Firmware, Serial, Platform, Device Time).
    """
    logging.info("Querying ESSL device metadata...")
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5)
    conn = None
    try:
        conn = zk.connect()
        fw = conn.get_firmware_version()
        sn = conn.get_serialnumber()
        platform = conn.get_platform()
        dev_name = conn.get_device_name()
        
        # Fetch device time
        dev_time_str = "Unknown"
        try:
            dev_time = conn.get_time()
            dev_time_str = dev_time.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
            
        msg = f"Device Info retrieved: Name='{dev_name}', FW='{fw}', SN='{sn}', Platform='{platform}', DeviceTime='{dev_time_str}'"
        logging.info(msg)
        push_test_log("INFO", msg)
        
        db.collection('device_testing').document('control').update({
            'deviceName': dev_name,
            'firmwareVersion': fw,
            'serialNumber': sn,
            'platform': platform,
            'deviceTime': dev_time_str
        })
    except Exception as e:
        err_msg = f"Failed to retrieve device metadata: {e}"
        logging.error(err_msg)
        push_test_log("ERROR", err_msg)
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass

def run_read_users():
    """
    FUNCTION 3 & 7: Read Users from ESSL device. Display in logs.
    """
    logging.info("Syncing user roster from biometric device...")
    push_test_log("INFO", "Syncing user roster from biometric device...")
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5)
    conn = None
    try:
        conn = zk.connect()
        users = conn.get_users()
        templates = conn.get_templates()
        
        users_list = []
        for u in users:
            # Count templates for enrollment status
            u_templates = [t for t in templates if str(t.uid) == str(u.user_id)]
            enrollment = "Fingerprint Enrolled" if len(u_templates) > 0 else "Card Only"
            
            user_info = {
                'userId': u.user_id,
                'name': u.name,
                'privilege': u.privilege,
                'enrollmentStatus': enrollment
            }
            users_list.append(user_info)
            logging.info(f"[User Roster] UserID: {u.user_id}, Name: {u.name}, Privilege: {u.privilege}, Enrollment: {enrollment}")
            
        success_msg = f"User Sync SUCCESS. Total users found: {len(users)}."
        logging.info(f"[User Sync Success] {success_msg}")
        push_test_log("SUCCESS", success_msg)
        
        db.collection('device_testing').document('control').update({
            'totalUsers': len(users),
            'usersList': users_list
        })
        
        # Write Firestore Test Record
        write_firebase_test_record("Connected", "ESSL K90 Pro", len(users), None)
        
    except Exception as e:
        err_msg = f"User Sync FAILED: {e}"
        logging.error(f"[User Sync Failed] {err_msg}")
        push_test_log("ERROR", err_msg)
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass

def run_read_attendance():
    """
    FUNCTION 4 & 7: Read Attendance logs. Display first 20 records.
    """
    logging.info("Reading attendance log database from biometric terminal...")
    push_test_log("INFO", "Reading attendance log database from biometric terminal...")
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5)
    conn = None
    try:
        conn = zk.connect()
        attendance = conn.get_attendance()
        
        # Get first 20 records
        first_20 = []
        for record in attendance[:20]:
            rec_info = {
                'userId': record.user_id,
                'timestamp': record.timestamp.strftime("%Y-%m-%d %H:%M:%S") if record.timestamp else "N/A",
                'punchType': record.punch
            }
            first_20.append(rec_info)
            logging.info(f"[Attendance Log] UserID: {record.user_id}, Timestamp: {record.timestamp}, Punch Type: {record.punch}")
            
        success_msg = f"Attendance Read SUCCESS. Total records in database: {len(attendance)}."
        logging.info(f"[Attendance Read Success] {success_msg}")
        push_test_log("SUCCESS", success_msg)
        
        # Display first 20 in logs
        push_test_log("INFO", f"First 20 logs: {first_20}")
        
        # Update control doc
        db.collection('device_testing').document('control').update({
            'totalAttendance': len(attendance),
            'attendanceLogs': first_20,
            'lastSyncTime': datetime.utcnow().isoformat() + 'Z'
        })
        
        # Write Firestore Test Record
        write_firebase_test_record("Connected", "ESSL K90 Pro", None, len(attendance))
        
    except Exception as e:
        err_msg = f"Attendance Read FAILED: {e}"
        logging.error(f"[Attendance Read Failed] {err_msg}")
        push_test_log("ERROR", err_msg)
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass

def write_firebase_test_record(status, name, users_count=None, att_count=None):
    """
    FUNCTION 5: Firebase Test log writer.
    Stores test runs in device_test_logs collection.
    """
    try:
        doc_data = {
            'connectionStatus': status,
            'deviceName': name,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'ip': DEVICE_IP,
            'port': DEVICE_PORT
        }
        
        # Preserve previous numbers if querying only users or attendance
        control_ref = db.collection('device_testing').document('control').get()
        control_data = control_ref.to_dict() if control_ref.exists else {}
        
        if users_count is not None:
            doc_data['usersCount'] = users_count
        else:
            doc_data['usersCount'] = control_data.get('totalUsers', 0)
            
        if att_count is not None:
            doc_data['attendanceCount'] = att_count
        else:
            doc_data['attendanceCount'] = control_data.get('totalAttendance', 0)
            
        db.collection('device_test_logs').add(doc_data)
        logging.info(f"[Firebase Test] Stored record in device_test_logs: {doc_data}")
    except Exception as e:
        logging.error(f"Failed to write firebase test record: {e}")

def db_listener(doc_snapshot, changes, read_time):
    """
    Snapshot listener thread for Firebase interactive buttons.
    """
    for doc in doc_snapshot:
        data = doc.to_dict()
        if not data:
            continue
            
        # Test Connection button
        if data.get('testConnectionPending', False):
            # Reset flag immediately
            db.collection('device_testing').document('control').update({
                'testConnectionPending': False
            })
            run_test_connection()
            
        # Read Users button
        if data.get('readUsersPending', False):
            # Reset flag immediately
            db.collection('device_testing').document('control').update({
                'readUsersPending': False
            })
            run_read_users()
            
        # Read Attendance button
        if data.get('readAttendancePending', False):
            # Reset flag immediately
            db.collection('device_testing').document('control').update({
                'readAttendancePending': False
            })
            run_read_attendance()

def main_loop():
    """
    Main loop handles startup seeding, snapshot listener, and auto reconnect health checks.
    """
    logging.info("Starting Warrior Gym OS Device Connectivity Tester...")
    
    # 1. Initialize Control Doc if missing
    control_ref = db.collection('device_testing').document('control')
    if not control_ref.get().exists:
        control_ref.set({
            'ip': DEVICE_IP,
            'port': DEVICE_PORT,
            'status': 'Disconnected',
            'totalUsers': 0,
            'totalAttendance': 0,
            'deviceName': 'ESSL K90 Pro',
            'firmwareVersion': 'Unknown',
            'serialNumber': 'Unknown',
            'platform': 'Unknown',
            'deviceTime': 'N/A',
            'lastSyncTime': None,
            'testLogs': [],
            'usersList': [],
            'attendanceLogs': [],
            'testConnectionPending': False,
            'readUsersPending': False,
            'readAttendancePending': False
        })
        
    # Clear logs at boot
    control_ref.update({'testLogs': []})
    
    # 2. Attach firestore snapshot listener for buttons
    doc_watch = control_ref.on_snapshot(db_listener)
    logging.info("Firestore interactive command listener attached successfully.")
    push_test_log("INFO", "Biometric tester daemon booted. Listening to CRM settings...")
    
    # 3. Connection and auto-reconnect polling (FUNCTION 6)
    while True:
        try:
            # Check TCP port socket
            is_up = check_tcp_connection(DEVICE_IP, DEVICE_PORT)
            current_status = "Connected" if is_up else "Disconnected"
            
            # Auto status log & database update
            global device_status
            if current_status != device_status:
                device_status = current_status
                db.collection('device_testing').document('control').update({
                    'status': device_status
                })
                
                if device_status == "Connected":
                    msg = f"Biometric terminal {DEVICE_IP}:{DEVICE_PORT} came ONLINE."
                    logging.info(msg)
                    push_test_log("SUCCESS", msg)
                    run_read_info()
                else:
                    msg = f"Biometric terminal {DEVICE_IP}:{DEVICE_PORT} went OFFLINE. Reconnect loop active."
                    logging.warning(msg)
                    push_test_log("WARNING", msg)
                    
            # Auto Sync Stats if connected
            if device_status == "Connected":
                # Quick check to keep stats updated
                zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5)
                conn = None
                try:
                    conn = zk.connect()
                    users = conn.get_users()
                    attendance = conn.get_attendance()
                    db.collection('device_testing').document('control').update({
                        'totalUsers': len(users),
                        'totalAttendance': len(attendance),
                        'lastSyncTime': datetime.utcnow().isoformat() + 'Z'
                    })
                except Exception:
                    pass
                finally:
                    if conn:
                        try:
                            conn.disconnect()
                        except Exception:
                            pass
                            
        except Exception as loop_err:
            logging.error(f"Error in main polling loop: {loop_err}")
            
        # Retry / check connectivity health every 10 seconds (FUNCTION 6)
        time.sleep(10)

if __name__ == "__main__":
    try:
        main_loop()
    except KeyboardInterrupt:
        logging.info("Tester service terminated by user.")
        sys.exit(0)
