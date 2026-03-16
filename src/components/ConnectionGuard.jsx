// Removed — was causing extra Supabase channels and DB polling overhead.
// With 400 players, each ConnectionGuard opened an extra heartbeat channel
// and pinged the DB every 20s = 400 extra channels + 1200 extra DB reads/minute.
// Supabase handles reconnection automatically. No guard needed.
export default function ConnectionGuard() { return null }
