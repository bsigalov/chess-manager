# Lessons Learned

## Player Dedup Bug
- The original import used `nofide-{name}` as fake FIDE IDs for players without one
- This caused dedup failures when the same player appeared in different tournaments with slightly different name spellings
- Fix: Never create fake FIDE IDs. Match by FIDE ID when available, fall back to name+country+rating fuzzy matching

## Schema Migration Strategy
- When multiple features need schema changes, batch them into a single migration
- This avoids migration conflicts when developing in parallel
- Always run `prisma generate` after schema changes before any code that uses the client

## Import Route Backward Compatibility
- The original POST /api/tournaments/import was synchronous
- New pipeline is async (BullMQ), but the old route needs to stay compatible
- Solution: Try new pipeline with sync fallback, keeping the same response shape
