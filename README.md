# RetailPrime ERP

RetailPrime is a multi-shop mobile retail ERP with a FastAPI/MongoDB backend and a Flutter mobile client. The legacy Expo source remains in `frontend/` for parity comparison; the active migration lives in `retailprime_flutter/`.

## Run

Backend configuration belongs in `backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=retailprime
```

```powershell
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

```powershell
cd C:\AIOH\AIOH
flutter pub get
# Android emulator
flutter run --dart-define=API_URL=http://10.0.2.2:8000/api
# Physical Android/iOS device: copy .env.example to development.env.json and
# set API_URL to the PC's actual LAN address, then use:
flutter run --dart-define-from-file=development.env.json
flutter analyze
flutter test
flutter build apk --debug
```

The Flutter app is feature-organised around Home, Sales, Inventory, Finance, Reports and Management. It has a centralized API client, light-only theme tokens, responsive Material UI, guarded loading/error states, POS stock-backed checkout, and camera barcode scanning.

## Backend safeguards

Invoice totals are calculated from catalog prices on the server. Product ownership, stock, payment and customer shop ownership are validated before writes; stock decrements use a conditional write and compensate on failure. Unique invoice/SKU/barcode indexes and atomic counter allocation prevent collisions. A replica-set MongoDB deployment can be used for full database transactions; the local standalone fallback uses the documented guarded compensation path.

# Legacy project brief
