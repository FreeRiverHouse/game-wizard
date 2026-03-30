#!/bin/bash
# Run this on Bubble (Mac Catalina) to start the automated Emilio test
# Usage: bash bubble-lab.sh

M4="http://192.168.1.234:3001/api/shop/chat"

echo "🫧 Bubble Lab starting..."

# Reset Emilio conversation
curl -s -X POST "$M4" -H "Content-Type: application/json" -d '{"message":"__reset__"}' > /dev/null
echo "✓ Emilio reset"
sleep 1

# Run Kimi/openclaw as Mattia
openclaw agent -m "You are simulating Mattia Petrucciani, an indie game developer, having a real conversation with his AI concierge Emilio. Emilio lives on another Mac at $M4

Your projects:
- game-studio: Pizza Gelato Rush, Unity mobile game with an AI self-improvement loop
- book-wizard: EPUB pipeline for editing and exporting books

For EACH of exactly 6 turns, do this sequence:
1. Decide what Mattia says next (short, casual, 1-2 sentences)
2. Send it with curl:
   REPLY=\$(curl -s -X POST $M4 -H 'Content-Type: application/json' -d \"{\\\"message\\\":\\\"MESSAGE_HERE\\\"}\")
3. Extract reply text:
   TEXT=\$(echo \$REPLY | python3 -c \"import sys,json; print(json.load(sys.stdin).get('reply',''))\")
4. Print it: echo \"EMILIO: \$TEXT\"
5. Sleep 2 seconds then do next turn

Conversation arc:
- Turn 1: Greet Emilio, ask what projects are active right now
- Turn 2: Ask for game-studio status
- Turn 3: Suggest adding an achievements system to the game
- Turn 4: Ask how book-wizard is going
- Turn 5: Decide to focus on game-studio today
- Turn 6: Ask Emilio to send the Coder to start working on game-studio

Start immediately with Turn 1. Do all 6 turns without stopping."
