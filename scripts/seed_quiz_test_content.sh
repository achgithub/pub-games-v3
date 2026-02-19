#!/bin/bash
# Seed quiz_db with is_test_content questions for mobile-test app.
# Creates a small PNG image and WAV audio file, inserts media_files rows,
# and inserts one text, one picture, and one music question.
#
# Run from the Pi as the activityhub user:
#   bash ~/pub-games-v3/scripts/seed_quiz_test_content.sh

set -e

GAME_ADMIN=~/pub-games-v3/games/game-admin/backend
UPLOADS_DIR=$GAME_ADMIN/uploads/quiz
IMG_FILE=$UPLOADS_DIR/images/test-question.png
AUD_FILE=$UPLOADS_DIR/audios/test-question.wav

# ── 1. Create directories ─────────────────────────────────────────────────────
mkdir -p "$UPLOADS_DIR/images"
mkdir -p "$UPLOADS_DIR/audios"

# ── 2. Ensure uploads symlinks exist for all quiz backends ────────────────────
for app in quiz-master quiz-display mobile-test; do
  LINK=~/pub-games-v3/games/$app/backend/uploads
  if [ ! -L "$LINK" ]; then
    ln -sfn "$GAME_ADMIN/uploads" "$LINK"
    echo "Created uploads symlink: $LINK"
  else
    echo "Symlink already exists: $LINK"
  fi
done

# ── 3. Generate test PNG (10×10 steel-blue square) ───────────────────────────
echo "Creating test image: $IMG_FILE"
python3 - "$IMG_FILE" <<'PYEOF'
import struct, zlib, sys

def png_chunk(tag, data):
    buf = tag + data
    return struct.pack('>I', len(data)) + buf + struct.pack('>I', zlib.crc32(buf) & 0xFFFFFFFF)

W, H = 200, 200
# Each row: filter byte 0, then W × RGB
row = bytes([0] + [70, 130, 180] * W)   # filter=0 + steel blue pixels
# Compress all rows concatenated
idat = zlib.compress(row * H)
png = (
    b'\x89PNG\r\n\x1a\n'
    + png_chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0))
    + png_chunk(b'IDAT', idat)
    + png_chunk(b'IEND', b'')
)
with open(sys.argv[1], 'wb') as f:
    f.write(png)
print(f'  Written {len(png)} bytes ({W}x{H} px blue PNG)')
PYEOF

# ── 4. Generate test WAV (3 seconds of silence, 8-bit mono 8 kHz) ─────────────
echo "Creating test audio: $AUD_FILE"
python3 - "$AUD_FILE" <<'PYEOF'
import struct, sys

SAMPLE_RATE = 8000
DURATION    = 3
data        = bytes([128] * SAMPLE_RATE * DURATION)   # 8-bit unsigned silence
data_size   = len(data)

with open(sys.argv[1], 'wb') as f:
    f.write(b'RIFF')
    f.write(struct.pack('<I', 36 + data_size))
    f.write(b'WAVE')
    f.write(b'fmt ')
    f.write(struct.pack('<I',  16))
    f.write(struct.pack('<H',   1))           # PCM
    f.write(struct.pack('<H',   1))           # mono
    f.write(struct.pack('<I', SAMPLE_RATE))
    f.write(struct.pack('<I', SAMPLE_RATE))   # byte rate (8-bit mono)
    f.write(struct.pack('<H',   1))           # block align
    f.write(struct.pack('<H',   8))           # bits per sample
    f.write(b'data')
    f.write(struct.pack('<I', data_size))
    f.write(data)
total = 36 + 8 + data_size
print(f'  Written {total} bytes ({DURATION}s silence WAV)')
PYEOF

# ── 5. Verify files exist ─────────────────────────────────────────────────────
echo ""
echo "Verifying files on disk:"
ls -lh "$IMG_FILE" "$AUD_FILE"

IMG_BYTES=$(wc -c < "$IMG_FILE")
AUD_BYTES=$(wc -c < "$AUD_FILE")

# ── 6. Seed quiz_db (delete + re-insert so paths are always correct) ──────────
echo ""
echo "Seeding quiz_db..."
psql -U activityhub -h localhost -p 5555 -d quiz_db <<SQL

-- Remove any old test media rows (re-seed cleanly)
DELETE FROM media_files WHERE filename IN ('test-question.png', 'test-question.wav');

-- Insert with leading / so browsers treat it as a root-relative URL
INSERT INTO media_files (filename, original_name, type, file_path, size_bytes, label)
VALUES
  ('test-question.png', 'test-question.png', 'image',
   '/uploads/quiz/images/test-question.png', $IMG_BYTES, 'Mobile Test Image'),
  ('test-question.wav', 'test-question.wav', 'audio',
   '/uploads/quiz/audios/test-question.wav', $AUD_BYTES, 'Mobile Test Audio');

-- Remove old test questions
DELETE FROM questions WHERE is_test_content = TRUE;

-- Text question
INSERT INTO questions (text, answer, type, is_test_content)
VALUES ('Mobile test: can you read this text clearly?', 'Yes', 'text', TRUE);

-- Picture question
INSERT INTO questions (text, answer, type, image_id, is_test_content)
VALUES (
  'Mobile test: can you see the blue square?', 'Yes', 'picture',
  (SELECT id FROM media_files WHERE filename = 'test-question.png'),
  TRUE
);

-- Music question
INSERT INTO questions (text, answer, type, audio_id, is_test_content)
VALUES (
  'Mobile test: did the audio play (3 seconds of silence)?', 'Yes', 'music',
  (SELECT id FROM media_files WHERE filename = 'test-question.wav'),
  TRUE
);

SELECT type, text FROM questions WHERE is_test_content = TRUE ORDER BY type;
SELECT type, file_path FROM media_files WHERE filename LIKE 'test-question%' ORDER BY type;
SQL

echo ""
echo "Done."
echo "Reload mobile-test — all three panels should show PASS."
