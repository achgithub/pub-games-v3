# Season Scheduler

Auto-generate balanced league schedules for pub sports (Darts, Pool, Crib).

## Features

- **Multi-sport support**: Darts, Pool, and Crib
- **Team management**: Add and remove pub teams
- **Smart scheduling**: Round-robin algorithm ensures balanced home/away games (no duplicates)
- **Holiday detection**: Integration with UK Bank Holidays API
- **Conflict detection**: Red highlighting when teams have multiple games on the same date
- **Manual adjustments**:
  - Reorder individual matches with arrow buttons
  - Multi-select to move blocks of matches together
  - Exclusions (free/special/catchup weeks) displace all games on that date
- **CSV export**: Download schedules for distribution
- **Version control**: Save multiple versions of schedules
- **Auto-cleanup**: Schedules automatically deleted after 30 days

## How It Works

### Setup Tab

1. **Select Sport**: Choose Darts, Pool, or Crib
2. **Add Teams**: Enter pub team names
3. **Set Schedule**:
   - Day of week (e.g., Wednesday nights)
   - Season start date
   - Season end date
4. **Generate**: Click "Generate Schedule"

### Schedule Tab

1. **Review** the auto-generated schedule
   - 🚨 Red highlighting = Team plays multiple games on this date (conflict)
   - ⚠️ Orange highlighting = Date is within 10 days of a UK Bank Holiday
2. **Adjust** matches as needed:
   - **Single move**: ⬆️ Top / ↑ Up / ↓ Down / ⬇️ Bottom buttons
   - **Bulk move**: Select multiple rows with checkboxes, then use move buttons
   - **Exclusions**: Moving a free/special/catchup week displaces ALL games on that date
3. **Name** your schedule and set version
4. **Save** using either:
   - 💾 Save button at the top (next to version)
   - 💾 Save button at the bottom

### Output Tab

1. **View** all saved schedules
2. **Download** as CSV for email/printing
3. **Note**: Schedules auto-delete after 30 days

## Scheduling Algorithm

The app uses a **round-robin tournament** algorithm with strict home/away balance:

1. **Each team plays all others exactly twice** (once at home, once away - NO DUPLICATES)
2. **Two-pass system**:
   - First pass: Generate all unique pairings with home/away alternation
   - Second pass: Take exact same pairings and swap home/away
3. **Balanced schedule**: Teams get equal home/away games across the season
4. **Bye weeks**: Automatically handled for odd number of teams

### Example

With 5 teams (A, B, C, D, E):
- Total matches needed: 20 (5 teams × 4 opponents × 2 = 20)
- One team has a bye each week
- Each team plays 8 games (4 home, 4 away)

## Holiday Detection

The app checks for UK Bank Holidays within your season:
- Christmas Day
- Boxing Day
- Easter
- Bank Holidays
- Other major events

Dates within 10 days of a holiday are highlighted for review.

## Database Schema

### Tables

- `teams`: User's pub teams by sport
- `schedules`: Saved schedule metadata
- `schedule_matches`: Individual match fixtures
- `schedule_dates`: Date markers (catch-up, free, special events)

### Data Retention

Schedules are automatically deleted after 30 days to keep the database clean. Download important schedules as CSV for long-term storage.

## API Endpoints

### Team Management
- `GET /api/teams?userId={id}&sport={sport}` - Get teams
- `POST /api/teams` - Add team
- `DELETE /api/teams/{id}` - Delete team

### Scheduling
- `GET /api/holidays?start={date}&end={date}` - Get UK Bank Holidays
- `POST /api/schedule/generate` - Generate schedule
- `POST /api/schedule/{id}/reorder` - Reorder matches
- `POST /api/schedule/{id}` - Save schedule

### Saved Schedules
- `GET /api/schedules?userId={id}` - List schedules
- `GET /api/schedules/{id}?userId={id}` - Get schedule
- `GET /api/schedules/{id}/download?userId={id}` - Download CSV

## Building and Running

### On Pi

```bash
# Build frontend
cd games/season-scheduler/frontend
npm install
npm run build

# Copy to backend
cp -r build/* ../backend/static/

# Run backend
cd ../backend
go run *.go

# Test
curl http://localhost:5040/api/config
curl http://localhost:5040/api/health
```

### Ports

- Backend: `5040`
- Frontend dev: `5041`

## Dependencies

### Backend
- Go 1.25
- PostgreSQL
- Gorilla mux
- UK Bank Holidays API

### Frontend
- React 18
- TypeScript 4.9
- No external UI libraries

## Future Enhancements

- [ ] Email distribution
- [x] Catch-up week markers (excluded dates with metadata)
- [x] Special event markers (excluded dates with metadata)
- [ ] Venue/location support
- [ ] Print-friendly view
- [ ] iCal export
- [ ] More sports support
- [ ] Conflict resolution wizard (suggest fixes for scheduling conflicts)

## Recent Improvements

- ✅ Fixed round-robin algorithm to guarantee each pairing appears exactly once (no duplicates)
- ✅ Exclusion weeks (free/special/catchup) now properly displace all games on that date
- ✅ Conflict detection highlights teams with multiple games on the same date
- ✅ Multi-select functionality for moving blocks of matches together
- ✅ Enhanced error messages for save failures
- ✅ Save button at top of page for easier access

## Notes

- Minimum 2 teams required
- Odd number of teams handled automatically with bye weeks
- Manual reordering available for fine-tuning
- All schedules include strict home/away balance (each team plays every other team once at home, once away)
- Conflicts can be resolved by moving exclusion weeks or manually reordering matches
