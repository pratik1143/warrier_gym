import sys
import json
import os
import time
import logging
from zk import ZK

CACHE_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), 'device_cache.json'))

def main():
    zk = ZK('192.168.18.11', port=4370, timeout=4)
    device_users = []
    success = False
    error_msg = ""

    # Attempt 1: Connect directly to ESSL K90 Pro machine
    try:
        conn = zk.connect()
        users = conn.get_users()
        for u in users:
            device_users.append({
                'user_id': str(u.user_id),
                'name': (u.name or '').strip(),
                'card': str(u.card) if u.card else ''
            })
        conn.disconnect()
        success = True

        # Save cache for instant offline reads
        try:
            with open(CACHE_FILE, 'w') as f:
                json.dump(device_users, f)
        except Exception:
            pass

    except Exception as e:
        error_msg = str(e)
        # Attempt 2: Read from cached device_users file if socket is busy
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r') as f:
                    device_users = json.load(f)
                    if len(device_users) > 0:
                        success = True
                        error_msg = "Read from device cache"
            except Exception:
                pass

    print(json.dumps({'success': success, 'count': len(device_users), 'users': device_users, 'error': error_msg}))

if __name__ == '__main__':
    main()
