from zk import ZK

ip = "192.168.18.11"
port = 4370

zk = ZK(
    ip,
    port=port,
    timeout=10
)

try:
    print("Connecting...")
    conn = zk.connect()
    print("CONNECTED SUCCESSFULLY")

    users = conn.get_users()
    print(f"TOTAL USERS : {len(users)}")

    for user in users[:10]:
        print(user.user_id, user.name)

    print("\n--- Attendance test ---")
    attendance = conn.get_attendance()
    print(f"TOTAL RECORDS : {len(attendance)}")

    for att in attendance[:20]:
        print(att.user_id, att.timestamp)

    conn.disconnect()

except Exception as e:
    print("ERROR")
    print(e)
