"""Explicit Firestore-mode archive implementation retained for pre-cutover use."""
import os
from pathlib import Path
from typing import Any


def start_firestore_listener(root, sheets, listeners, upsert):
    service_account = Path(os.getenv("AIOH_FIREBASE_SERVICE_ACCOUNT", root / "aioh-retailprime-firebase-adminsdk-fbsvc-b83720d31a.json"))
    if not service_account.exists():
        return
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        if not firebase_admin._apps:
            firebase_admin.initialize_app(credentials.Certificate(service_account))
        client = firestore.client()
        def receive(snapshot: Any, _changes: Any, _read_time: Any) -> None:
            for document in snapshot:
                collection_name = document.reference.parent.parent.id
                sheet = sheets.get(collection_name)
                if sheet:
                    try:
                        upsert(sheet, {"id": document.id, **document.to_dict()})
                    except Exception:
                        pass
        listeners.append(client.collection_group("records").on_snapshot(receive))
    except Exception:
        return
