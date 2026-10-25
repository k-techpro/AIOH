"""Idempotent recovery. Defaults to dry-run; use --apply to write missing records."""
import argparse, json
from datetime import date, datetime
from pathlib import Path
from typing import Any
import firebase_admin
from firebase_admin import credentials, firestore
from pymongo import MongoClient

PROJECT_ID = "aioh-retailprime"
DATABASE_ID = "default"  # Enterprise Firestore database ID; not the Standard "(default)" ID.
UID = "53RkfgSSN3USUvtceny57iiZiqj2"
SERVICE_ACCOUNT = Path(__file__).resolve().parents[2] / "aioh-retailprime-firebase-adminsdk-fbsvc-b83720d31a.json"

def normal(value: Any) -> Any:
    if isinstance(value, dict): return {str(k): normal(v) for k, v in value.items()}
    if isinstance(value, list): return [normal(v) for v in value]
    if isinstance(value, (datetime, date)): return value.isoformat()
    return value

def migrate(apply: bool):
    if not SERVICE_ACCOUNT.is_file(): raise RuntimeError("Firebase service account file is missing.")
    if json.loads(SERVICE_ACCOUNT.read_text(encoding="utf-8")).get("project_id") != PROJECT_ID: raise RuntimeError("Service account project mismatch.")
    app = firebase_admin.initialize_app(credentials.Certificate(str(SERVICE_ACCOUNT)), {"projectId": PROJECT_ID})
    database = firestore.client(app=app, database_id=DATABASE_ID)
    target = database.collection("users").document(UID).collection("businessData")
    mongo = MongoClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=5000)["retailprime"]
    report = {"project": PROJECT_ID, "database": DATABASE_ID, "uid": UID, "apply": apply, "collections": {}}
    for name in sorted(mongo.list_collection_names()):
        # Firestore collections require an odd number of path segments.  Each
        # business domain is therefore a document below `businessData` with a
        # `records` subcollection; this keeps every historical record separate
        # and allows its original id to be reused deterministically.
        destination = target.document(name).collection("records")
        source = list(mongo[name].find({}))
        # One collection read is substantially faster and safer than issuing a
        # network request per legacy record.  It still compares every
        # deterministic document id before any create operation is sent.
        existing_docs = {snapshot.id: normal(snapshot.to_dict()) for snapshot in destination.stream()}
        result = {"mongodb": len(source), "firestore_before": len(existing_docs), "selected": 0, "migrated": 0, "skipped": 0, "conflicts": []}
        writes = []
        for legacy in source:
            legacy_id = str(legacy.get("id") or legacy.get("_id") or ("settings" if name == "settings" else ""))
            payload = normal({key: value for key, value in legacy.items() if key != "_id"})
            if name == "settings" and "id" not in payload:
                payload["id"] = legacy_id
            if not legacy_id: result["conflicts"].append({"reason": "missing legacy id"}); continue
            existing = existing_docs.get(legacy_id)
            if existing is not None:
                if existing == payload: result["skipped"] += 1
                else: result["conflicts"].append({"id": legacy_id, "reason": "existing Firestore document differs"})
            else: writes.append((destination.document(legacy_id), payload))
        result["selected"] = len(writes)
        if apply:
            for start in range(0, len(writes), 400):
                batch = database.batch()
                for ref, payload in writes[start:start + 400]: batch.create(ref, payload)
                batch.commit(); result["migrated"] += len(writes[start:start + 400])
        result["firestore_after"] = result["firestore_before"] + result["migrated"]
        report["collections"][name] = result
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--apply", action="store_true"); parser.add_argument("--report", type=Path, default=Path("migration-report.json")); args = parser.parse_args()
    result = migrate(args.apply); args.report.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"); print(json.dumps(result, indent=2, ensure_ascii=False))
