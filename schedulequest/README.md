# ScheduleQuest

Local-first single-page planner and gamified task app built with React + Vite.

## Run

```bash
npm install
npm run dev
```

## Local-only accounts & saving

ScheduleQuest stores everything in browser `localStorage` only.

- Accounts key: `sq_local_accounts_v1`
  - Shape: `{ [username]: { username, passHash, createdAt } }`
- Active user key: `sq_active_user_v1`
  - Value: `username`
- Per-user game state key: `sq_state_v1_<username>`

Password/PIN values are hashed with SHA-256 using Web Crypto before saving (`passHash`), so plaintext credentials are not stored.

Per-user state includes schedule blocks, tasks, streaks, XP, levels, coins, powerups, achievements, daily quests, settings, and history. State autosaves with a 300ms debounce after changes, and user sessions persist across reloads.

## Notes

- No Firebase, Firestore, or backend database is used.
- Works offline after first load via service worker cache (`public/sw.js`).
