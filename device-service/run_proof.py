import time
import sys
from datetime import datetime
from zk import ZK
import firebase_admin
from firebase_admin import credentials, firestore

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
candidates = [
    BASE_DIR / "serviceAccountKey.json",
    BASE_DIR.parent / "backend" / "serviceAccountKey.json",
    BASE_DIR.parent / "serviceAccountKey.json",
]
SERVICE_ACCOUNT_PATH = next((c for c in candidates if c.exists()), None)
db = None
firebase_init_success = False

if SERVICE_ACCOUNT_PATH:
    try:
        cred = credentials.Certificate(str(SERVICE_ACCOUNT_PATH))
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        firebase_init_success = True
    except Exception as e:
        print(f"Firebase Init Error: {e}")

DEVICE_IP = "192.168.18.11"
DEVICE_PORT = 4370

print("=================================================")
print("1. Device Connection Test")
print("=================================================")

start_time = time.time()
zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=10)
conn = None
connection_success = False

try:
    conn = zk.connect()
    connection_time = time.time() - start_time
    print("Connection: Connected")
    print(f"Connection Time: {connection_time:.4f} seconds")
    connection_success = True
except Exception as e:
    connection_time = time.time() - start_time
    print("Connection: Failed")
    print(f"Error: {e}")
    print(f"Connection Time: {connection_time:.4f} seconds")
    sys.exit(1)

print("\n=================================================")
print("2. Read Users Test")
print("=================================================")

users_count = 0
first_10_users = []

try:
    users = conn.get_users()
    users_count = len(users)
    print(f"Total Users Found: {users_count}")
    print("First 10 Users:")
    for user in users[:10]:
        print(f"  User ID: {user.user_id} | User Name: {user.name}")
except Exception as e:
    print(f"Read Users Error: {e}")

print("\n=================================================")
print("3. Read Attendance Test")
print("=================================================")

attendance_count = 0

try:
    attendance = conn.get_attendance()
    attendance_count = len(attendance)
    print(f"Total Attendance Records: {attendance_count}")
    print("Last 20 Attendance Records:")
    # Get last 20 records
    for att in attendance[-20:]:
        print(f"  User ID: {att.user_id} | Timestamp: {att.timestamp}")
except Exception as e:
    print(f"Read Attendance Error: {e}")

print("\n=================================================")
print("4. Firebase Test")
print("=================================================")

firebase_write_success = False
collection_name = "device_test_logs"
doc_id = ""

try:
    test_doc = {
        'connectionStatus': 'Connected' if connection_success else 'Failed',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'usersCount': users_count,
        'attendanceCount': attendance_count,
        'ip': DEVICE_IP,
        'port': DEVICE_PORT,
        'source': 'run_proof_script'
    }
    # Add record to Firestore
    update_time, doc_ref = db.collection(collection_name).add(test_doc)
    doc_id = doc_ref.id
    firebase_write_success = True
    print(f"Collection Name: {collection_name}")
    print(f"Document ID: {doc_id}")
    print("Write Success: True")
except Exception as e:
    print("Write Success: False")
    print(f"Firebase Write Error: {e}")

print("\n=================================================")
print("SUCCESS CRITERIA")
print("=================================================")

if users_count > 0 and attendance_count > 0 and firebase_write_success:
    print("CONNECTED VERIFIED")
else:
    print("VERIFICATION FAILED")
print("=================================================")

print("\n=================================================")
print("5. Live Punch Test")
print("=================================================")
print("Please punch your fingerprint on the device now...")
print("=================================================")

try:
    # Clear any buffered events first if possible, then start live capture
    for event in conn.live_capture():
        if event is None:
            continue
        
        # When event occurs
        biometric_id = event.user_id
        timestamp_str = event.timestamp.strftime("%Y-%m-%d %I:%M %p") if event.timestamp else datetime.now().strftime("%Y-%m-%d %I:%M %p")
        device_name = "ESSL K90 Pro"
        
        # Write record to Firestore attendance
        fs_sync_success = False
        try:
            att_doc_id = f"proof_punch_{biometric_id}_{int(time.time())}"
            db.collection('attendance').document(att_doc_id).set({
                'attendanceId': att_doc_id,
                'memberId': f"proof_{biometric_id}",
                'biometricId': str(biometric_id),
                'deviceName': device_name,
                'timestamp': event.timestamp.isoformat() + 'Z' if event.timestamp else datetime.utcnow().isoformat() + 'Z',
                'status': 'granted',
                'method': 'biometric',
                'createdAt': datetime.utcnow().isoformat() + 'Z'
            })
            fs_sync_success = True
        except Exception as fs_err:
            pass
            
        print(f"Biometric ID: {biometric_id}")
        print(f"Timestamp: {timestamp_str}")
        print(f"Device: {device_name}")
        print(f"Firebase Sync Success: {fs_sync_success}")
        print("=================================================")
        # Exit after first captured punch as requested
        break
        
except KeyboardInterrupt:
    print("\nLive Punch Test cancelled by user.")
finally:
    if conn:
        try:
            conn.disconnect()
        except:
            pass
