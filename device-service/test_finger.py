from zk import ZK
zk = ZK("192.168.18.11", port=4370, timeout=5)
conn = None
try:
    conn = zk.connect()
    templates = conn.get_templates()
    if templates:
        t = templates[0]
        print("Template class:", type(t))
        print("Template attributes:", dir(t))
        print("Template dict:", getattr(t, '__dict__', 'No __dict__'))
        try:
            print("Template user_id:", t.user_id)
        except Exception as e:
            print("Template user_id access error:", e)
        try:
            print("Template uid:", t.uid)
        except Exception as e:
            print("Template uid access error:", e)
        try:
            print("Template pin:", t.pin)
        except Exception as e:
            print("Template pin access error:", e)
except Exception as e:
    print("Failed to run test:", e)
finally:
    if conn:
        conn.disconnect()
