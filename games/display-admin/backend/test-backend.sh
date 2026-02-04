#!/bin/bash
# Display Admin Backend Test Script
# Run after: go run *.go

HOST="http://localhost:5050"
TOKEN="demo-token-andy@example.com"  # Replace with actual admin user

echo "=== Test 1: Health Check ==="
curl -s "$HOST/api/health" | jq
echo -e "\n"

echo "=== Test 2: Create Display ==="
DISPLAY=$(curl -s -X POST "$HOST/api/displays" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Bar TV","location":"Main Bar","description":"Test display"}' | jq)
echo "$DISPLAY"
DISPLAY_ID=$(echo "$DISPLAY" | jq -r '.data.id')
DISPLAY_TOKEN=$(echo "$DISPLAY" | jq -r '.data.token')
echo "Created Display ID: $DISPLAY_ID, Token: $DISPLAY_TOKEN"
echo -e "\n"

echo "=== Test 3: Get All Displays ==="
curl -s "$HOST/api/displays" \
  -H "Authorization: Bearer $TOKEN" | jq
echo -e "\n"

echo "=== Test 4: Get Display QR Code (saved as test-qr.png) ==="
curl -s "$HOST/api/displays/$DISPLAY_ID/qr" \
  -H "Authorization: Bearer $TOKEN" \
  -o test-qr.png
echo "QR code saved to test-qr.png"
echo -e "\n"

echo "=== Test 5: Create Content Item (Announcement) ==="
CONTENT=$(curl -s -X POST "$HOST/api/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Welcome Message","content_type":"announcement","duration_seconds":15,"text_content":"Welcome to our pub!","bg_color":"#003366","text_color":"#FFFFFF"}' | jq)
echo "$CONTENT"
CONTENT_ID=$(echo "$CONTENT" | jq -r '.data.id')
echo "Created Content ID: $CONTENT_ID"
echo -e "\n"

echo "=== Test 6: Create Playlist ==="
PLAYLIST=$(curl -s -X POST "$HOST/api/playlists" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Playlist","description":"Test slideshow"}' | jq)
echo "$PLAYLIST"
PLAYLIST_ID=$(echo "$PLAYLIST" | jq -r '.data.id')
echo "Created Playlist ID: $PLAYLIST_ID"
echo -e "\n"

echo "=== Test 7: Add Content to Playlist ==="
curl -s -X POST "$HOST/api/playlists/$PLAYLIST_ID/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_item_id\":$CONTENT_ID}" | jq
echo -e "\n"

echo "=== Test 8: Get Playlist with Content ==="
curl -s "$HOST/api/playlists/$PLAYLIST_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
echo -e "\n"

echo "=== Test 9: Assign Playlist to Display ==="
ASSIGNMENT=$(curl -s -X POST "$HOST/api/assignments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"display_id\":$DISPLAY_ID,\"playlist_id\":$PLAYLIST_ID,\"priority\":5}" | jq)
echo "$ASSIGNMENT"
echo -e "\n"

echo "=== Test 10: Preview Display (What TV would see) ==="
curl -s "$HOST/api/preview/display/$DISPLAY_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
echo -e "\n"

echo "=== BONUS: Verify TV can authenticate with token ==="
curl -s "$HOST/api/display/by-token/$DISPLAY_TOKEN" | jq
echo -e "\n"

echo "✅ All tests complete!"
echo "QR code saved as: test-qr.png"
echo "Display Token: $DISPLAY_TOKEN"
