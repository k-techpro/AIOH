# Local Excel and file archive

Run this service on the Windows host that contains the master workbook:

```powershell
cd C:\AIOH\AIOH\backend
python -m pip install -r requirements.txt
uvicorn archive_service:app --host 0.0.0.0 --port 8001
```

It uses the existing `Excel\AIOH_ERP_Live.xlsx.xlsx` workbook without creating,
clearing, renaming, or replacing it.  Firestore's collection-group listener
receives committed writes from both mobile and web and upserts rows by Firestore
document ID.  The listener is enabled with the existing Firebase service-account
file, or set `AIOH_FIREBASE_SERVICE_ACCOUNT` to its explicit path.

The archive destination can be overridden with `AIOH_EXCEL_PATH`; invoice folders
with `AIOH_INVOICE_ROOT`; and request authentication can be enabled by setting
`AIOH_ARCHIVE_KEY` (web clients must then send it via a trusted server/proxy,
not a public browser build).
