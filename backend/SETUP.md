# Backend setup

The Flutter client loads live dashboard, sales, inventory and finance data from
this FastAPI service. The service requires a reachable MongoDB database.

1. Start MongoDB locally, or create a MongoDB Atlas database.
2. Copy `env.template` to `.env` and set `MONGO_URL` and `DB_NAME`.
3. Run `pip install -r requirements.txt`, then `uvicorn server:app --reload`.
4. Check `http://127.0.0.1:8000/api/health`, then seed the initial demo records
   by sending `POST` to `http://127.0.0.1:8000/api/seed`.

For an Android emulator use `http://10.0.2.2:8000/api`. For a physical phone,
use your computer's LAN IP in `development.env.json` and run Flutter with
`--dart-define-from-file=development.env.json`.

Install a release build on a phone, not a debug build:

```powershell
flutter build apk --release --dart-define-from-file=development.env.json
```

The Android compatibility dialog in the supplied screenshot is emitted by the
operating system for a debuggable APK. A release build removes that debug-app
warning. If Android still reports 16 KB native-library alignment after a release
build, update the installed Flutter SDK and rebuild; the alignment is in Flutter
engine/plugin native libraries, not in a Dart screen.
