#!/bin/bash
# Bubble-side script: runs on Mac Catalina, sends messages to Emilio on M4
# Uses clawdbot (available on Bubble) instead of openclaw

export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH

M4="http://192.168.1.234:3001/api/shop/chat"

echo "🫧 Bubble Lab starting..."

# Reset Emilio conversation
curl -s -X POST "$M4" -H "Content-Type: application/json" -d '{"message":"__reset__"}' > /dev/null
echo "✓ Emilio reset"
sleep 1

# Run Kimi as Mattia via clawdbot
clawdbot agent --agent main --local -m "You are Mattia Petrucciani, an indie game developer talking to your AI concierge Emilio. Emilio is at http://192.168.1.234:3001/api/shop/chat

Your projects: game-studio (Pizza Gelato Rush mobile game with AI loop) and book-wizard (EPUB pipeline).

Do EXACTLY 6 turns, one after another. For each turn:
1. Write a short casual message as Mattia (1-2 sentences)
2. Run this bash command to send it (replace YOUR_MESSAGE with actual text, no special chars):
   REPLY=\$(curl -s -X POST http://192.168.1.234:3001/api/shop/chat -H 'Content-Type: application/json' -d '{\"message\":\"YOUR_MESSAGE\"}')
3. Extract Emilio reply:
   TEXT=\$(echo \"\$REPLY\" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get(\"reply\",\"\"))' 2>/dev/null || echo \"\$REPLY\")
4. Print: echo \"EMILIO: \$TEXT\"
5. sleep 2

Conversation arc:
Turn 1: Greet Emilio, ask what projects are active
Turn 2: Ask for game-studio status
Turn 3: Suggest adding achievements system to the game
Turn 4: Ask about book-wizard
Turn 5: Decide to focus on game-studio today
Turn 6: Tell Emilio to send the Coder to work on game-studio

GO. Start Turn 1 immediately. Do all 6 turns without asking for confirmation."
