#!/usr/bin/env python3
"""
Bubble Lab: Kimi as Mattia → talks to Emilio on M4
Run on Bubble: python3 bubble-kimi.py
"""
import json, subprocess, urllib.request, urllib.error, sys, time, ssl

# Catalina has outdated SSL certs — bypass verification
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

M4 = "http://192.168.1.234:3001/api/shop/chat"
NVIDIA_KEY = "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"
KIMI_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

SYSTEM = """You are Mattia Petrucciani, an indie game developer and creative director.
You are having a casual conversation with your AI concierge Emilio inside Onde-Flow.
Your active projects:
- game-studio: Pizza Gelato Rush, a Unity mobile game with an AI self-improvement loop
- book-wizard: an EPUB pipeline for editing and exporting books

Respond as Mattia: short, casual, 1-2 sentences max. No greetings like "sure!" — just speak naturally as Mattia."""

TURNS = [
    ("Ask Emilio what projects are currently active",
     "Hey Emilio! What projects do we have going on right now?"),
    ("Ask for game-studio status — where are we at?",
     "Give me the game-studio status — where are we at?"),
    ("Suggest adding an achievements system to the game",
     "I want to add an achievements system to the game."),
    ("Ask how book-wizard is going",
     "What about book-wizard? How's the EPUB pipeline coming along?"),
    ("Tell Emilio you want to focus on game-studio today",
     "Ok, let's focus on game-studio for now."),
    ("Tell Emilio to send the Coder to start working on game-studio",
     "Perfect Emilio, send the Coder to work on game-studio with the tasks you have in mind."),
]

ORKEY = "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"
OR_URL = "https://openrouter.ai/api/v1/chat/completions"

history = []

def post_json(url, data, headers={}):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=30, context=_ssl_ctx) as r:
        return json.loads(r.read())

def send_to_emilio(message):
    try:
        data = post_json(M4, {"message": message, "remoteAudio": True})
        return data.get("reply", "")
    except Exception as e:
        print(f"  ✗ Emilio error: {e}")
        return ""

def llm_as_mattia(url, model, key, turn_hint, prev_emilio=""):
    messages = [{"role": "system", "content": SYSTEM}]
    for h in history[-4:]:
        messages.append({"role": "user", "content": h["mattia"]})
        if h.get("emilio"):
            messages.append({"role": "assistant", "content": f"[Emilio said: {h['emilio']}]"})
    messages.append({"role": "user", "content": f"[Directive: {turn_hint}. Previous Emilio reply: '{prev_emilio}'. Write exactly what Mattia says — 1-2 casual sentences.]"})
    resp = post_json(url, {
        "model": model, "messages": messages, "max_tokens": 150, "temperature": 0.8,
    }, headers={"Authorization": f"Bearer {key}"})
    msg = resp["choices"][0]["message"]
    content = msg.get("content") or msg.get("reasoning_content") or ""
    content = content.strip()
    if "<think>" in content and "</think>" in content:
        content = content.split("</think>")[-1].strip()
    return content or None

def kimi_as_mattia(turn_hint, prev_emilio=""):
    messages = [{"role": "system", "content": SYSTEM}]
    for h in history[-4:]:
        messages.append({"role": "user", "content": h["mattia"]})
        if h.get("emilio"):
            messages.append({"role": "assistant", "content": f"[Emilio said: {h['emilio']}]"})
    messages.append({"role": "user", "content": f"[Directive for this turn: {turn_hint}. Previous Emilio reply: '{prev_emilio}'. Now write exactly what Mattia says — 1-2 casual sentences.]"})
    # Try Kimi first, then OpenRouter Llama free as fallback
    for attempt, (url, model, key, label) in enumerate([
        (KIMI_URL, "moonshotai/kimi-k2.5", NVIDIA_KEY, "Kimi"),
        (OR_URL, "meta-llama/llama-3.3-70b-instruct:free", ORKEY, "Llama"),
    ]):
        try:
            result = llm_as_mattia(url, model, key, turn_hint, prev_emilio)
            if result:
                if attempt > 0: print(f"  [fallback: {label}]")
                return result
        except Exception as e:
            print(f"  ✗ {label} error: {e}")
            if attempt == 0: time.sleep(2)
    return None

def say(text):
    try:
        subprocess.run(["say", "-v", "Samantha", text], timeout=30)
    except:
        pass

print("🫧 Bubble Lab — Kimi as Mattia → Emilio on M4")
print("=" * 50)

# Reset Emilio
try:
    post_json(M4, {"message": "__reset__"})
    print("✓ Emilio reset\n")
except Exception as e:
    print(f"✗ Cannot reach Emilio: {e}")
    sys.exit(1)

time.sleep(1)
emilio_reply = ""

for i, (hint, fallback_msg) in enumerate(TURNS):
    print(f"─── Turn {i+1}/6 ───────────────────────")

    # Generate Mattia's line via Kimi → Llama → hardcoded fallback
    mattia_msg = kimi_as_mattia(hint, emilio_reply)
    if not mattia_msg:
        mattia_msg = fallback_msg
        print(f"  [scripted fallback]")

    print(f"MATTIA: {mattia_msg}")
    say(mattia_msg)  # Bubble speaks Mattia

    # Send to Emilio
    time.sleep(0.5)
    emilio_reply = send_to_emilio(mattia_msg)

    if emilio_reply:
        print(f"EMILIO: {emilio_reply}")
        # M4 plays Emilio (remoteAudio=True means M4 DOES play)
        # If you want Bubble to also play: uncomment next line
        # say(emilio_reply)

    history.append({"mattia": mattia_msg, "emilio": emilio_reply})

    if i < len(TURNS) - 1:
        time.sleep(2)

print("\n" + "=" * 50)
print("🫧 Bubble Lab complete!")
