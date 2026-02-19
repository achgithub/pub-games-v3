#!/bin/bash
# Seed quiz_db with is_test_content questions for mobile-test app.
# Creates a small PNG image and WAV audio file, inserts media_files rows,
# and inserts one text, one picture, and one music question.
#
# Run from the Pi as the activityhub user:
#   bash ~/pub-games-v3/scripts/seed_quiz_test_content.sh

set -e

UPLOADS_DIR=~/pub-games-v3/games/game-admin/backend/uploads/quiz
IMG_FILE=$UPLOADS_DIR/images/test-question.png
AUD_FILE=$UPLOADS_DIR/audios/test-question.wav

# ── 1. Create directories ─────────────────────────────────────────────────────
mkdir -p "$UPLOADS_DIR/images"
mkdir -p "$UPLOADS_DIR/audios"

# ── 2. Generate test PNG (1×1 steel-blue pixel) ───────────────────────────────
echo "Creating test image: $IMG_FILE"
python3 - "$IMG_FILE" <<'PYEOF'
import struct, zlib, sys

def png_chunk(tag, data):
    buf = tag + data
    return struct.pack('>I', len(data)) + buf + struct.pack('>I', zlib.crc32(buf) & 0xFFFFFFFF)

# 1×1 RGB PNG, one row: filter byte 0, then R G B
row = bytes([0, 70, 130, 180])  # filter=0, steel blue
idat = zlib.compress(row)
png = (
    b'\x89PNG\r\n\x1a\n'
    + png_chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
    + png_chunk(b'IDAT', idat)
    + png_chunk(b'IEND', b'')
)
with open(sys.argv[1], 'wb') as f:
    f.write(png)
print(f'  Written {len(png)} bytes')
PYEOF

# ── 3. Generate test WAV (3 seconds of silence, 8-bit mono 8 kHz) ─────────────
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
    f.write(struct.pack('<I',  16))           # fmt chunk size
    f.write(struct.pack('<H',   1))           # PCM
    f.write(struct.pack('<H',   1))           # mono
    f.write(struct.pack('<I', SAMPLE_RATE))   # sample rate
    f.write(struct.pack('<I', SAMPLE_RATE))   # byte rate (8-bit mono)
    f.write(struct.pack('<H',   1))           # block align
    f.write(struct.pack('<H',   8))           # bits per sample
    f.write(b'data')
    f.write(struct.pack('<I', data_size))
    f.write(data)
print(f'  Written {36 + 8 + data_size} bytes')
PYEOF

# ── 4. Get file sizes for the DB ──────────────────────────────────────────────
IMG_BYTES=$(wc -c < "$IMG_FILE")
AUD_BYTES=$(wc -c < "$AUD_FILE")

# ── 5. Insert into quiz_db ────────────────────────────────────────────────────
echo "Seeding quiz_db..."
psql -U activityhub -h localhost -p 5555 -d quiz_db <<SQL

-- Media files (skip if already seeded)
INSERT INTO media_files (filename, original_name, type, file_path, size_bytes, label)
SELECT 'test-question.png', 'test-question.png', 'image',
       'uploads/quiz/images/test-question.png', $IMG_BYTES, 'Mobile Test Image'
WHERE NOT EXISTS (
    SELECT 1 FROM media_files WHERE filename = 'test-question.png'
);

INSERT INTO media_files (filename, original_name, type, file_path, size_bytes, label)
SELECT 'test-question.wav', 'test-question.wav', 'audio',
       'uploads/quiz/audios/test-question.wav', $AUD_BYTES, 'Mobile Test Audio'
WHERE NOT EXISTS (
    SELECT 1 FROM media_files WHERE filename = 'test-question.wav'
);

-- Text question
INSERT INTO questions (text, answer, type, is_test_content)
SELECT 'Mobile test: can you read this text clearly?', 'Yes', 'text', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM questions WHERE is_test_content = TRUE AND type = 'text'
);

-- Picture question
INSERT INTO questions (text, answer, type, image_id, is_test_content)
SELECT 'Mobile test: can you see the blue square?', 'Yes',
       'picture',
       (SELECT id FROM media_files WHERE filename = 'test-question.png' LIMIT 1),
       TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM questions WHERE is_test_content = TRUE AND type = 'picture'
);

-- Music question
INSERT INTO questions (text, answer, type, audio_id, is_test_content)
SELECT 'Mobile test: did the audio play (3 seconds of silence)?', 'Yes',
       'music',
       (SELECT id FROM media_files WHERE filename = 'test-question.wav' LIMIT 1),
       TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM questions WHERE is_test_content = TRUE AND type = 'music'
);

SELECT type, text, is_test_content FROM questions WHERE is_test_content = TRUE ORDER BY type;
SQL

echo ""
echo "Done. Open mobile-test in a browser to verify all three panels show PASS."
