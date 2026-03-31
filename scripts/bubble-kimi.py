#!/usr/bin/env python3
"""
Bubble Lab: Claude-as-Mattia (via M4 endpoint) → talks to Emilio on M4
Run on Bubble: python3 bubble-kimi.py
"""
import json, subprocess, urllib.request, sys, time, ssl

# Catalina has outdated SSL certs — bypass for HTTPS requests
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

M4_BASE = "http://192.168.1.234:3001"
EMILIO_URL = f"{M4_BASE}/api/shop/chat"
MATTIA_URL = f"{M4_BASE}/api/mattia/chat"

history = []

def post_json(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    # HTTP to M4 (LAN) — no SSL needed, but use context anyway for safety
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read())

def get_mattia_line(emilio_reply=""):
    """Ask M4's Claude to generate Mattia's next line."""
    try:
        data = post_json(MATTIA_URL, {
            "message": emilio_reply,
            "history": [{"role": k, "content": v} for h in history for k, v in h.items() if v]
        })
        return data.get("reply", "").strip()
    except Exception as e:
        print(f"  ✗ Mattia/Claude error: {e}")
        return None

def send_to_emilio(message):
    """Send Mattia's message to Emilio, get reply. M4 plays audio via afplay."""
    try:
        data = post_json(EMILIO_URL, {"message": message})
        return data.get("reply", "")
    except Exception as e:
        print(f"  ✗ Emilio error: {e}")
        return ""

def say(text):
    try:
        subprocess.run(["say", "-v", "Samantha", text], timeout=30)
    except:
        pass

print("🫧 Bubble Lab — Claude as Mattia → Emilio on M4")
print("=" * 52)
print("  Mattia voice: Bubble 🫧 (Samantha)")
print("  Emilio voice: M4 🎵 (JennyNeural)")
print("=" * 52)

# Reset Emilio
try:
    post_json(EMILIO_URL, {"message": "__reset__"})
    print("✓ Emilio reset\n")
except Exception as e:
    print(f"✗ Cannot reach M4: {e}")
    sys.exit(1)

time.sleep(1)
emilio_reply = ""

for turn in range(1, 7):
    print(f"─── Turn {turn}/6 ───────────────────────")

    # Generate Mattia's line via Claude on M4
    mattia_msg = get_mattia_line(emilio_reply)
    if not mattia_msg:
        print("  ✗ Could not generate Mattia line, skipping")
        continue

    print(f"MATTIA: {mattia_msg}")
    say(mattia_msg)  # Bubble speaks Mattia with Samantha voice

    # Send to Emilio — M4 will play reply via JennyNeural afplay
    time.sleep(0.5)
    emilio_reply = send_to_emilio(mattia_msg)

    if emilio_reply:
        print(f"EMILIO: {emilio_reply}")

    history.append({"mattia": mattia_msg, "emilio": emilio_reply})

    if turn < 6:
        time.sleep(3)

print("\n" + "=" * 52)
print("🫧 Bubble Lab complete!")
