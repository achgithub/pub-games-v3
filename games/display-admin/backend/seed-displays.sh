#!/bin/bash
# Display Admin Seed Script
# Creates 2 TVs with example content and playlists
# Run after: go run *.go

HOST="http://localhost:5050"
TOKEN="demo-token-admin@pubgames.local"  # Admin user from pubgames.users

echo "=========================================="
echo "  Display Admin - Seeding Test Data"
echo "=========================================="
echo ""

# === DISPLAYS ===
echo "📺 Creating Displays..."

echo "Creating Display 1: Main Bar TV"
DISPLAY1=$(curl -s -X POST "$HOST/api/displays" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Main Bar TV","location":"Main Bar","description":"Primary display above the bar"}')
DISPLAY1_ID=$(echo "$DISPLAY1" | jq -r '.data.id')
DISPLAY1_TOKEN=$(echo "$DISPLAY1" | jq -r '.data.token')
echo "  ✓ Created Display 1 (ID: $DISPLAY1_ID)"

echo "Creating Display 2: Lounge TV"
DISPLAY2=$(curl -s -X POST "$HOST/api/displays" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lounge TV","location":"Lounge Area","description":"Secondary display in the lounge"}')
DISPLAY2_ID=$(echo "$DISPLAY2" | jq -r '.data.id')
DISPLAY2_TOKEN=$(echo "$DISPLAY2" | jq -r '.data.token')
echo "  ✓ Created Display 2 (ID: $DISPLAY2_ID)"
echo ""

# === CONTENT ITEMS ===
echo "📝 Creating Content Items..."

echo "Creating Content 1: Welcome Announcement (10s)"
CONTENT1=$(curl -s -X POST "$HOST/api/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Welcome!","content_type":"announcement","duration_seconds":10,"text_content":"Welcome to our pub! Enjoy your stay.","bg_color":"#003366","text_color":"#FFFFFF"}')
CONTENT1_ID=$(echo "$CONTENT1" | jq -r '.data.id')
echo "  ✓ Created Content 1 (ID: $CONTENT1_ID)"

echo "Creating Content 2: Daily Specials (15s)"
CONTENT2=$(curl -s -X POST "$HOST/api/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Daily Specials","content_type":"announcement","duration_seconds":15,"text_content":"Fish & Chips £12.95 | Burger £9.95 | Sunday Roast £14.95","bg_color":"#1a1a1a","text_color":"#FFD700"}')
CONTENT2_ID=$(echo "$CONTENT2" | jq -r '.data.id')
echo "  ✓ Created Content 2 (ID: $CONTENT2_ID)"

echo "Creating Content 3: Live Sports (12s)"
CONTENT3=$(curl -s -X POST "$HOST/api/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Live Sports Tonight","content_type":"announcement","duration_seconds":12,"text_content":"Premier League 8PM | Champions League 9:45PM","bg_color":"#00AA00","text_color":"#FFFFFF"}')
CONTENT3_ID=$(echo "$CONTENT3" | jq -r '.data.id')
echo "  ✓ Created Content 3 (ID: $CONTENT3_ID)"

echo "Creating Content 4: Happy Hour (10s)"
CONTENT4=$(curl -s -X POST "$HOST/api/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Happy Hour","content_type":"announcement","duration_seconds":10,"text_content":"5-7PM Daily | 2-for-1 Selected Drinks","bg_color":"#AA0000","text_color":"#FFFFFF"}')
CONTENT4_ID=$(echo "$CONTENT4" | jq -r '.data.id')
echo "  ✓ Created Content 4 (ID: $CONTENT4_ID)"

echo "Creating Content 5: Leaderboard (20s)"
CONTENT5=$(curl -s -X POST "$HOST/api/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Game Leaderboard","content_type":"leaderboard","duration_seconds":20,"url":"http://192.168.1.45:5030"}')
CONTENT5_ID=$(echo "$CONTENT5" | jq -r '.data.id')
echo "  ✓ Created Content 5 (ID: $CONTENT5_ID)"

echo "Creating Content 6: Event Schedule (15s)"
CONTENT6=$(curl -s -X POST "$HOST/api/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Upcoming Events","content_type":"schedule","duration_seconds":15,"url":"http://192.168.1.45:5040"}')
CONTENT6_ID=$(echo "$CONTENT6" | jq -r '.data.id')
echo "  ✓ Created Content 6 (ID: $CONTENT6_ID)"

echo "Creating Content 7: Pub Website (25s)"
CONTENT7=$(curl -s -X POST "$HOST/api/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Visit Our Website","content_type":"url","duration_seconds":25,"url":"http://192.168.1.45:3001"}')
CONTENT7_ID=$(echo "$CONTENT7" | jq -r '.data.id')
echo "  ✓ Created Content 7 (ID: $CONTENT7_ID)"

echo "Creating Content 8: Quiz Night (12s)"
CONTENT8=$(curl -s -X POST "$HOST/api/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Quiz Night!","content_type":"announcement","duration_seconds":12,"text_content":"Every Thursday 8PM | £2 Entry | Cash Prize!","bg_color":"#6A0DAD","text_color":"#FFFFFF"}')
CONTENT8_ID=$(echo "$CONTENT8" | jq -r '.data.id')
echo "  ✓ Created Content 8 (ID: $CONTENT8_ID)"
echo ""

# === PLAYLISTS ===
echo "📋 Creating Playlists..."

echo "Creating Playlist 1: Main Bar Rotation"
PLAYLIST1=$(curl -s -X POST "$HOST/api/playlists" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Main Bar Rotation","description":"High-energy rotation for main bar area"}')
PLAYLIST1_ID=$(echo "$PLAYLIST1" | jq -r '.data.id')
echo "  ✓ Created Playlist 1 (ID: $PLAYLIST1_ID)"

echo "Creating Playlist 2: Lounge Rotation"
PLAYLIST2=$(curl -s -X POST "$HOST/api/playlists" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lounge Rotation","description":"Relaxed rotation for lounge area"}')
PLAYLIST2_ID=$(echo "$PLAYLIST2" | jq -r '.data.id')
echo "  ✓ Created Playlist 2 (ID: $PLAYLIST2_ID)"
echo ""

# === ADD CONTENT TO PLAYLIST 1 (Main Bar) ===
echo "➕ Adding Content to Playlist 1 (Main Bar)..."
curl -s -X POST "$HOST/api/playlists/$PLAYLIST1_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT1_ID}" > /dev/null
echo "  ✓ Added Welcome (10s)"

curl -s -X POST "$HOST/api/playlists/$PLAYLIST1_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT2_ID}" > /dev/null
echo "  ✓ Added Daily Specials (15s)"

curl -s -X POST "$HOST/api/playlists/$PLAYLIST1_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT5_ID}" > /dev/null
echo "  ✓ Added Leaderboard (20s)"

curl -s -X POST "$HOST/api/playlists/$PLAYLIST1_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT3_ID}" > /dev/null
echo "  ✓ Added Live Sports (12s)"

curl -s -X POST "$HOST/api/playlists/$PLAYLIST1_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT4_ID}" > /dev/null
echo "  ✓ Added Happy Hour (10s)"

curl -s -X POST "$HOST/api/playlists/$PLAYLIST1_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT8_ID}" > /dev/null
echo "  ✓ Added Quiz Night (12s)"
echo "  Total: 6 items, 79 seconds per rotation"
echo ""

# === ADD CONTENT TO PLAYLIST 2 (Lounge) ===
echo "➕ Adding Content to Playlist 2 (Lounge)..."
curl -s -X POST "$HOST/api/playlists/$PLAYLIST2_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT1_ID}" > /dev/null
echo "  ✓ Added Welcome (10s)"

curl -s -X POST "$HOST/api/playlists/$PLAYLIST2_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT6_ID}" > /dev/null
echo "  ✓ Added Event Schedule (15s)"

curl -s -X POST "$HOST/api/playlists/$PLAYLIST2_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT2_ID}" > /dev/null
echo "  ✓ Added Daily Specials (15s)"

curl -s -X POST "$HOST/api/playlists/$PLAYLIST2_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT7_ID}" > /dev/null
echo "  ✓ Added Website (25s)"

curl -s -X POST "$HOST/api/playlists/$PLAYLIST2_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT5_ID}" > /dev/null
echo "  ✓ Added Leaderboard (20s)"
echo "  Total: 5 items, 85 seconds per rotation"
echo ""

# === ASSIGN PLAYLISTS TO DISPLAYS ===
echo "🔗 Assigning Playlists to Displays..."

echo "Assigning Main Bar Rotation to Main Bar TV"
curl -s -X POST "$HOST/api/assignments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"display_id\":$DISPLAY1_ID,\"playlist_id\":$PLAYLIST1_ID,\"priority\":10}" > /dev/null
echo "  ✓ Assigned"

echo "Assigning Lounge Rotation to Lounge TV"
curl -s -X POST "$HOST/api/assignments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"display_id\":$DISPLAY2_ID,\"playlist_id\":$PLAYLIST2_ID,\"priority\":10}" > /dev/null
echo "  ✓ Assigned"
echo ""

# === GENERATE QR CODES ===
echo "📱 Generating QR Codes..."
curl -s "$HOST/api/displays/$DISPLAY1_ID/qr" \
  -H "Authorization: Bearer $TOKEN" \
  -o main-bar-tv-qr.png
echo "  ✓ Saved main-bar-tv-qr.png"

curl -s "$HOST/api/displays/$DISPLAY2_ID/qr" \
  -H "Authorization: Bearer $TOKEN" \
  -o lounge-tv-qr.png
echo "  ✓ Saved lounge-tv-qr.png"
echo ""

# === SUMMARY ===
echo "=========================================="
echo "  ✅ Seeding Complete!"
echo "=========================================="
echo ""
echo "📺 DISPLAYS:"
echo "  1. Main Bar TV (ID: $DISPLAY1_ID)"
echo "     Token: $DISPLAY1_TOKEN"
echo "     QR Code: main-bar-tv-qr.png"
echo "     Playlist: Main Bar Rotation (6 items, 79s cycle)"
echo ""
echo "  2. Lounge TV (ID: $DISPLAY2_ID)"
echo "     Token: $DISPLAY2_TOKEN"
echo "     QR Code: lounge-tv-qr.png"
echo "     Playlist: Lounge Rotation (5 items, 85s cycle)"
echo ""
echo "📝 CONTENT ITEMS: 8 total"
echo "  - 5 Announcements (various timings)"
echo "  - 1 Leaderboard (20s)"
echo "  - 1 Event Schedule (15s)"
echo "  - 1 Website URL (25s)"
echo ""
echo "🔗 RUNTIME URLS:"
echo "  Main Bar TV: http://192.168.1.45:5051"
echo "    → Enter token: $DISPLAY1_TOKEN"
echo ""
echo "  Lounge TV: http://192.168.1.45:5051"
echo "    → Enter token: $DISPLAY2_TOKEN"
echo ""
echo "🎛️  ADMIN INTERFACE:"
echo "  http://192.168.1.45:5050"
echo ""
echo "💡 NEXT STEPS:"
echo "  1. Push and pull on Pi"
echo "  2. Build Display Runtime frontend"
echo "  3. Start both backends (5050 and 5051)"
echo "  4. Open runtime URLs and test with tokens"
echo ""
