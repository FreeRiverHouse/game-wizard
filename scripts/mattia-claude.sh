#!/bin/bash
# Organic Mattia→Emilio conversation using Claude on M4
# Claude plays Mattia naturally, Emilio responds as usual
# Audio: Emilio speaks via afplay (JennyNeural) on M4 speakers

M4="http://192.168.1.234:3001/api/shop/chat"
TURNS=6

echo "🎭 Mattia (Claude) → Emilio conversation"
echo "========================================="

# Reset Emilio
curl -s -X POST "$M4" -H "Content-Type: application/json" -d '{"message":"__reset__"}' > /dev/null
echo "✓ Emilio reset"
echo ""

HISTORY=""
EMILIO_REPLY=""

for i in $(seq 1 $TURNS); do
  echo "─── Turn $i/$TURNS ───────────────────────"

  # Build prompt for Claude-as-Mattia
  if [ -z "$HISTORY" ]; then
    CONTEXT="This is the start of the conversation."
  else
    CONTEXT="Conversation so far:
$HISTORY"
  fi

  MATTIA_MSG=$(claude -p "You are Mattia Petrucciani, an indie game developer. You are having a casual, real conversation with Emilio, your AI concierge in Onde-Flow (a creative OS).

Your projects:
- game-studio: Pizza Gelato Rush, Unity mobile game with AI self-improvement loop
- book-wizard: EPUB pipeline for editing/exporting books

$CONTEXT
${EMILIO_REPLY:+Emilio just said: \"$EMILIO_REPLY\"}

Write ONLY what Mattia says next — 1-2 casual sentences, no quotes, no prefix.
Arc: start by greeting and asking about projects → ask game-studio status → suggest a feature → ask about book-wizard → decide to focus on game-studio → tell Emilio to send the Coder.
Turn $i of $TURNS." 2>/dev/null | tr -d '\n' | sed 's/[""]/"/g')

  if [ -z "$MATTIA_MSG" ]; then
    echo "  ✗ Claude failed"
    continue
  fi

  echo "MATTIA: $MATTIA_MSG"

  # Send to Emilio
  RESPONSE=$(curl -s -X POST "$M4" \
    -H "Content-Type: application/json" \
    -d "{\"message\": $(echo "$MATTIA_MSG" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))')}")

  EMILIO_REPLY=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('reply',''))" 2>/dev/null)

  if [ -n "$EMILIO_REPLY" ]; then
    echo "EMILIO: $EMILIO_REPLY"
    # Emilio already plays via afplay on M4 speakers (server-side)
    HISTORY="$HISTORY
Mattia: $MATTIA_MSG
Emilio: $EMILIO_REPLY"
  else
    echo "  ✗ No reply from Emilio"
  fi

  echo ""
  [ $i -lt $TURNS ] && sleep 4
done

echo "========================================="
echo "🎭 Conversation complete!"
