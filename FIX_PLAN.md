### Diagnostic Result
The previous code used `.neq('doctor_id', null)` which caused a Postgres error `22P02: invalid input syntax for type uuid: "null"`.
This error happens silently in the frontend (or logs to console which user doesn't see).

### The Fix
Change `.neq('doctor_id', null)` to `.not('doctor_id', 'is', null)`.
This was verified with `debug_service_logic.ts` which now successfully returns merged data.

### Next Steps
1. Apply fix to `storageService.ts`.
2. Sync to GitHub.
3. Notify user to reload.
