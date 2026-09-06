import sys
import time
import logging
from zk import ZK

def main():
    if len(sys.argv) < 2:
        print("Usage: python enroll_hardware.py <biometric_id> [member_name]")
        sys.exit(1)
        
    bio_id = sys.argv[1]
    member_name = sys.argv[2] if len(sys.argv) > 2 else "Member"
    
    print(f"Connecting to ESSL K90 Pro at 192.168.18.11:4370 for User ID #{bio_id} ({member_name})...")
    zk = ZK('192.168.18.11', port=4370, timeout=8)
    try:
        conn = zk.connect()
        print(f"Connected! Registering user slot #{bio_id} on ESSL machine...")
        
        # Enable device so screen & scanner are active
        conn.enable_device()
        try:
            conn.set_user(uid=int(bio_id), name=member_name[:20], privilege=0, password='', group_id='', user_id=str(bio_id))
        except Exception as e:
            print(f"Note on set_user: {e}")
            
        print("SENDING ENROLLMENT COMMAND TO ESSL MACHINE DISPLAY...")
        print("Please place finger on ESSL scanner 3 times!")
        try:
            conn.enroll_user(uid=int(bio_id), temp_id=0, user_id=str(bio_id))
        except Exception as ex:
            print(f"Enrollment command sent to machine: {ex}")

        # Check for fingerprint template on machine
        print("Monitoring machine memory for fingerprint template...")
        enrolled = False
        for attempt in range(1, 10):
            time.sleep(1.5)
            try:
                templates = conn.get_templates()
                for t in templates:
                    if str(t.uid) == str(bio_id) or (hasattr(t, 'user_id') and str(t.user_id) == str(bio_id)):
                        enrolled = True
                        break
                if enrolled:
                    break
            except Exception as te:
                pass

        conn.enable_device()
        conn.disconnect()

        if enrolled:
            print(f"ENROLLED_SUCCESS: Fingerprint template captured & saved on ESSL machine for User #{bio_id}!")
        else:
            print(f"ENROLLED_WAITING: ESSL machine is ready for User #{bio_id}. Please place finger 3 times on physical scanner.")

    except Exception as e:
        print(f"Hardware Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
