import sys
import os
import time
import threading
import urllib.request
import io
import logging
from datetime import datetime

try:
    import tkinter as tk
    from PIL import Image, ImageTk, ImageDraw
    HAS_GUI = True
except Exception as e:
    HAS_GUI = False
    logging.warning(f"Tkinter/PIL GUI unavailable: {e}")

# Enable High-DPI Scaling Awareness on Windows for crisp typography & graphics
if sys.platform == 'win32':
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def _create_circular_image(image_bytes_or_pil, size=(96, 96)):
    """Converts image bytes or PIL object to a circular PhotoImage."""
    try:
        if isinstance(image_bytes_or_pil, bytes):
            img = Image.open(io.BytesIO(image_bytes_or_pil)).convert("RGBA")
        elif isinstance(image_bytes_or_pil, Image.Image):
            img = image_bytes_or_pil.convert("RGBA")
        else:
            return None

        img = img.resize(size, Image.Resampling.LANCZOS)
        
        # Create smooth anti-aliased circular mask
        mask = Image.new('L', size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size[0], size[1]), fill=255)
        
        output = Image.new('RGBA', size, (0, 0, 0, 0))
        output.paste(img, (0, 0), mask=mask)
        return ImageTk.PhotoImage(output)
    except Exception as e:
        logging.error(f"Error making circular image: {e}")
        return None


def show_attendance_popup(popup_data):
    """
    Triggers a Premium Always-On-Top Windows Desktop Overlay Popup Window.
    Appears above Chrome, Excel, Word, or any minimized desktop app.
    
    popup_data dict keys:
    - status: 'granted' | 'denied' | 'unknown' | 'expired' | 'frozen'
    - memberName: str
    - memberId / memberCode: str
    - plan: str
    - daysRemaining: int or str
    - visitCount: int or str
    - avatarUrl: str (optional)
    - deviceId / deviceName: str
    - biometricId: str
    - timestamp: str
    """
    if not HAS_GUI:
        logging.warning("[Popup] Skipping popup because Tkinter/GUI is not available.")
        return

    def _gui_thread():
        try:
            root = tk.Tk()
            root.title("The Warrior Gym OS")

            # Always on top & borderless window
            root.attributes("-topmost", True)
            root.overrideredirect(True)

            status = str(popup_data.get('status', 'granted')).lower()
            member_name = popup_data.get('memberName', 'Gym Member')
            member_code = popup_data.get('memberCode', popup_data.get('memberId', ''))
            plan_name = popup_data.get('plan', 'Standard Membership')
            days_left = popup_data.get('daysRemaining', popup_data.get('daysLeft', 'N/A'))
            visit_count = popup_data.get('visitCount', 1)
            avatar_url = popup_data.get('avatarUrl', '')
            biometric_id = popup_data.get('biometricId', popup_data.get('deviceId', 'N/A'))
            expired_days = popup_data.get('expiredDays', 0)

            # Modern Color Palettes & Status Mapping
            first_checkin = popup_data.get('firstCheckInTime', popup_data.get('checkIn', ''))
            current_punch = popup_data.get('currentPunchTime', popup_data.get('timestamp', ''))

            if status == 'granted':
                bg_color = "#0b0f19"      # Rich Dark Slate 950
                card_border = "#10b981"   # Emerald 500
                header_bg = "#042f2e"     # Emerald 950
                status_text = "✓ ACCESS GRANTED"
                status_fg = "#34d399"     # Emerald 400
                badge_bg = "#064e3b"
                message = "Welcome Back! 💪"
            elif status == 'already_inside':
                bg_color = "#0b0f19"
                card_border = "#0284c7"   # Sky 600
                header_bg = "#0c4a6e"     # Sky 950
                status_text = "✓ ALREADY INSIDE"
                status_fg = "#38bdf8"     # Sky 400
                badge_bg = "#0369a1"
                message = f"First Check-in Today: {first_checkin[11:16] if len(first_checkin)>=16 else 'Today'}"
            elif status in ('denied', 'expired', 'frozen'):
                bg_color = "#0b0f19"
                card_border = "#ef4444"   # Red 500
                header_bg = "#450a0a"     # Red 950
                status_text = "⚠ ACCESS DENIED"
                status_fg = "#f87171"     # Red 400
                badge_bg = "#7f1d1d"
                message = f"Expired {expired_days} days ago" if expired_days else "Membership Expired"
            else: # unmapped
                bg_color = "#0b0f19"
                card_border = "#f59e0b"   # Amber 500
                header_bg = "#451a03"     # Amber 950
                status_text = "⚠ MEMBER NOT MAPPED"
                status_fg = "#fbbf24"     # Amber 400
                badge_bg = "#78350f"
                message = f"ESSL Device User ID #{biometric_id} needs CRM mapping"

            # Window Dimensions and Top-Right Positioning
            win_width = 390
            win_height = 440
            screen_w = root.winfo_screenwidth()
            
            x_pos = screen_w - win_width - 25
            y_pos = 35
            root.geometry(f"{win_width}x{win_height}+{x_pos}+{y_pos}")
            root.configure(bg=card_border)

            # Outer Border Wrapper
            main_frame = tk.Frame(root, bg=bg_color, bd=0)
            main_frame.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)

            # 1. Header Bar
            header_frame = tk.Frame(main_frame, bg=header_bg, height=48)
            header_frame.pack(fill=tk.X, side=tk.TOP)
            header_frame.pack_propagate(False)

            header_title = tk.Label(
                header_frame, 
                text="⚡ THE WARRIOR GYM OS", 
                font=("Segoe UI", 10, "bold"), 
                fg="#ffffff", 
                bg=header_bg
            )
            header_title.pack(side=tk.LEFT, padx=16)

            close_btn = tk.Label(
                header_frame, 
                text="✕", 
                font=("Segoe UI", 12, "bold"), 
                fg="#94a3b8", 
                bg=header_bg,
                cursor="hand2"
            )
            close_btn.pack(side=tk.RIGHT, padx=14)
            close_btn.bind("<Button-1>", lambda e: root.destroy())

            # 2. Status Badge Banner
            status_badge_frame = tk.Frame(main_frame, bg=badge_bg, bd=0)
            status_badge_frame.pack(fill=tk.X, padx=16, pady=(14, 6))

            status_label = tk.Label(
                status_badge_frame, 
                text=status_text, 
                font=("Segoe UI", 11, "bold"), 
                fg=status_fg, 
                bg=badge_bg,
                pady=6
            )
            status_label.pack()

            # 3. Circular Member Avatar
            photo_img = None
            if avatar_url and avatar_url.startswith("http"):
                try:
                    req = urllib.request.Request(avatar_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        img_data = resp.read()
                        photo_img = _create_circular_image(img_data, size=(92, 92))
                except Exception as e:
                    logging.warning(f"Could not download member avatar: {e}")

            avatar_canvas = tk.Canvas(main_frame, width=92, height=92, bg=bg_color, highlightthickness=0)
            avatar_canvas.pack(pady=6)

            if photo_img:
                avatar_canvas.create_image(46, 46, image=photo_img)
                avatar_canvas.image = photo_img
            else:
                clean_name = member_name.replace("Unmapped Biometric User #", "ID ")
                parts = clean_name.split()
                initials = (parts[0][0] + (parts[1][0] if len(parts) > 1 else '')).upper() if parts else "AZ"
                avatar_canvas.create_oval(2, 2, 90, 90, fill="#1e293b", outline=card_border, width=2)
                avatar_canvas.create_text(46, 46, text=initials[:2], font=("Segoe UI", 20, "bold"), fill="#ffffff")

            # 4. Member Name & Reference Code
            name_label = tk.Label(
                main_frame, 
                text=member_name, 
                font=("Segoe UI", 13, "bold"), 
                fg="#ffffff", 
                bg=bg_color
            )
            name_label.pack(pady=(2, 0))

            if member_code:
                code_label = tk.Label(
                    main_frame, 
                    text=f"Ref: {member_code}", 
                    font=("Consolas", 9), 
                    fg="#64748b", 
                    bg=bg_color
                )
                code_label.pack()

            # 5. Details Info Box
            info_box = tk.Frame(main_frame, bg="#1e293b", bd=0)
            info_box.pack(fill=tk.X, padx=18, pady=10)

            if status in ('granted', 'already_inside'):
                r1 = tk.Label(info_box, text=f"Plan: {plan_name}", font=("Segoe UI", 9, "bold"), fg="#e2e8f0", bg="#1e293b")
                r1.pack(anchor="w", padx=14, pady=(8, 2))
                
                r2 = tk.Label(info_box, text=f"Days Remaining: {days_left} Days", font=("Segoe UI", 9, "bold"), fg="#34d399", bg="#1e293b")
                r2.pack(anchor="w", padx=14, pady=2)

                r3_text = f"First Check-in: {first_checkin[11:16]}" if status == 'already_inside' and first_checkin else f"Today's Visit: #{visit_count}"
                r3 = tk.Label(info_box, text=r3_text, font=("Segoe UI", 9), fg="#38bdf8" if status == 'already_inside' else "#94a3b8", bg="#1e293b")
                r3.pack(anchor="w", padx=14, pady=(2, 8))
            elif status in ('denied', 'expired', 'frozen'):
                r1 = tk.Label(info_box, text=f"Plan: {plan_name}", font=("Segoe UI", 9, "bold"), fg="#e2e8f0", bg="#1e293b")
                r1.pack(anchor="w", padx=14, pady=(8, 2))
                
                r2 = tk.Label(info_box, text=message, font=("Segoe UI", 9, "bold"), fg="#f87171", bg="#1e293b")
                r2.pack(anchor="w", padx=14, pady=(2, 8))
            else: # unmapped
                r1 = tk.Label(info_box, text=f"ESSL Hardware User ID: #{biometric_id}", font=("Segoe UI", 9, "bold"), fg="#e2e8f0", bg="#1e293b")
                r1.pack(anchor="w", padx=14, pady=(8, 2))
                
                r2 = tk.Label(info_box, text="Biometric ID needs CRM member mapping", font=("Segoe UI", 9), fg="#fbbf24", bg="#1e293b")
                r2.pack(anchor="w", padx=14, pady=(2, 8))

            # 6. Action Button Footer
            if status in ('granted', 'already_inside'):
                msg_label = tk.Label(
                    main_frame, 
                    text=message, 
                    font=("Segoe UI", 10, "bold"), 
                    fg="#38bdf8" if status == 'already_inside' else "#34d399", 
                    bg=bg_color
                )
                msg_label.pack(pady=4)
            elif status in ('denied', 'expired', 'frozen'):
                def open_renew():
                    import webbrowser
                    url = f"http://localhost:3000/dashboard/members/{popup_data.get('memberId', '')}/renew"
                    webbrowser.open(url)
                    root.destroy()

                btn = tk.Button(
                    main_frame, 
                    text="⚡ RENEW MEMBERSHIP", 
                    font=("Segoe UI", 9, "bold"), 
                    fg="#ffffff", 
                    bg="#ef4444", 
                    activebackground="#dc2626",
                    activeforeground="#ffffff",
                    bd=0, 
                    padx=16, 
                    pady=6, 
                    cursor="hand2",
                    command=open_renew
                )
                btn.pack(pady=4)
            else: # unmapped
                btn_box = tk.Frame(main_frame, bg=bg_color)
                btn_box.pack(pady=4)

                def trigger_automap():
                    import webbrowser
                    try:
                        req = urllib.request.Request("http://localhost:5000/api/devices/auto-map-biometrics", method="POST")
                        urllib.request.urlopen(req, timeout=3)
                    except Exception:
                        pass
                    webbrowser.open("http://localhost:3000/dashboard/settings/member-migration")
                    root.destroy()

                def open_mapping():
                    import webbrowser
                    webbrowser.open("http://localhost:3000/dashboard/settings/member-migration")
                    root.destroy()

                btn_auto = tk.Button(
                    btn_box, 
                    text="⚡ AUTO MAP", 
                    font=("Segoe UI", 9, "bold"), 
                    fg="#ffffff", 
                    bg="#2563eb", 
                    activebackground="#1d4ed8",
                    activeforeground="#ffffff",
                    bd=0, 
                    padx=12, 
                    pady=6, 
                    cursor="hand2",
                    command=trigger_automap
                )
                btn_auto.pack(side=tk.LEFT, padx=6)

                btn_map = tk.Button(
                    btn_box, 
                    text="⚡ MAP MEMBER", 
                    font=("Segoe UI", 9, "bold"), 
                    fg="#0f172a", 
                    bg="#f59e0b", 
                    activebackground="#d97706",
                    activeforeground="#0f172a",
                    bd=0, 
                    padx=12, 
                    pady=6, 
                    cursor="hand2",
                    command=open_mapping
                )
                btn_map.pack(side=tk.LEFT, padx=6)

            # Auto close after 7 seconds
            root.after(7000, lambda: root.destroy() if root.winfo_exists() else None)
            
            root.mainloop()
        except Exception as ex:
            logging.error(f"[Popup Thread Error]: {ex}")

    t = threading.Thread(target=_gui_thread, daemon=True)
    t.start()


# Standalone Test
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Testing Popup...")
    show_attendance_popup({
        'status': 'unknown',
        'memberName': 'Unmapped Biometric User #1145',
        'memberCode': 'ID #1145',
        'plan': 'Unmapped Biometric ID',
        'deviceId': 'Main Gate',
        'biometricId': '1145'
    })
    time.sleep(3)
