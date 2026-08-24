"""
Backend API test suite for RetailPrime ERP.
Covers shops, dashboard, products, customers, invoices, expenses, transfers, GST report and seed.
Also verifies no MongoDB _id leaks and invoice creation decrements stock.
"""
import os
import json
import pytest
import requests
from pathlib import Path

# Load EXPO_PUBLIC_BACKEND_URL from frontend/.env manually (no default!)
_env_path = Path("/app/frontend/.env")
BASE_URL = None
for line in _env_path.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
        break
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing from frontend/.env"

API = f"{BASE_URL}/api"


def _no_id(obj):
    """Recursively assert no MongoDB _id leaks in response."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked: {list(obj.keys())}"
        for v in obj.values():
            _no_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_id(v)


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- SHOPS ----------
class TestShops:
    def test_list_shops(self, client):
        r = client.get(f"{API}/shops")
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert len(data) == 2, f"Expected 2 shops, got {len(data)}"
        ids = {s["id"] for s in data}
        assert ids == {"shop-1", "shop-2"}
        names = {s["name"] for s in data}
        assert names == {"Poonamallee", "Kundrathur"}
        for s in data:
            for field in ("today_sales", "today_invoices", "products", "low_stock", "trend"):
                assert field in s, f"Missing {field} in shop {s['id']}"
            assert isinstance(s["trend"], list) and len(s["trend"]) == 7


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_dashboard_shop_1(self, client):
        r = client.get(f"{API}/dashboard/shop-1")
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        for key in ("kpis", "trend_30", "top_products", "categories",
                    "low_stock_items", "recent_invoices", "outstanding_invoices"):
            assert key in data, f"Missing {key}"
        kpis = data["kpis"]
        for k in ("today_sales", "today_profit", "today_orders", "outstanding",
                  "monthly_revenue", "low_stock", "out_stock"):
            assert k in kpis, f"Missing KPI {k}"
        assert isinstance(data["trend_30"], list) and len(data["trend_30"]) == 30

    def test_dashboard_all(self, client):
        r = client.get(f"{API}/dashboard/all")
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert data["kpis"]["total_products"] >= 70  # both shops


# ---------- PRODUCTS ----------
class TestProducts:
    def test_list_products(self, client):
        r = client.get(f"{API}/products", params={"shop_id": "shop-1"})
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert len(data) >= 30
        assert all(p["shop_id"] == "shop-1" for p in data)

    def test_list_products_category_filter(self, client):
        r = client.get(f"{API}/products", params={"shop_id": "shop-1", "category": "Smartphones"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        assert all(p["category"] == "Smartphones" for p in data)

    def test_list_products_search(self, client):
        r = client.get(f"{API}/products", params={"shop_id": "shop-1", "search": "iPhone"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        assert all("iphone" in p["name"].lower() for p in data)

    def test_list_products_is_accessory(self, client):
        r = client.get(f"{API}/products", params={"shop_id": "shop-1", "is_accessory": "true"})
        assert r.status_code == 200
        data = r.json()
        assert all(p["is_accessory"] is True for p in data)

    def test_get_product_by_id(self, client):
        lst = client.get(f"{API}/products", params={"shop_id": "shop-1"}).json()
        pid = lst[0]["id"]
        r = client.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert data["id"] == pid

    def test_get_product_404(self, client):
        r = client.get(f"{API}/products/nonexistent-id-xxx")
        assert r.status_code == 404

    def test_create_product(self, client):
        payload = {
            "shop_id": "shop-1", "name": "TEST_ProductAlpha", "brand": "TestBrand",
            "category": "Smartphones", "sku": "SKU-TEST-1", "barcode": "8901234567890",
            "hsn": "8517", "cost_price": 100.0, "selling_price": 199.0, "gst": 18,
            "stock": 10, "min_stock": 2, "is_accessory": False,
        }
        r = client.post(f"{API}/products", json=payload)
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert "id" in data
        # Verify persisted
        got = client.get(f"{API}/products/{data['id']}")
        assert got.status_code == 200
        assert got.json()["name"] == "TEST_ProductAlpha"


# ---------- CUSTOMERS ----------
class TestCustomers:
    def test_list_customers(self, client):
        r = client.get(f"{API}/customers", params={"shop_id": "shop-1"})
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert len(data) > 0

    def test_customer_search(self, client):
        r = client.get(f"{API}/customers", params={"shop_id": "shop-1", "search": "Kumar"})
        assert r.status_code == 200
        data = r.json()
        assert all("kumar" in c["name"].lower() or "kumar" in c["phone"].lower() for c in data)

    def test_get_customer_with_invoices(self, client):
        lst = client.get(f"{API}/customers", params={"shop_id": "shop-1"}).json()
        cid = lst[0]["id"]
        r = client.get(f"{API}/customers/{cid}")
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert data["id"] == cid
        assert "invoices" in data and isinstance(data["invoices"], list)

    def test_create_customer(self, client):
        payload = {"shop_id": "shop-1", "name": "TEST_Customer1", "phone": "+91 9000000000"}
        r = client.post(f"{API}/customers", json=payload)
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert data["id"] and data["total_purchases"] == 0


# ---------- INVOICES ----------
class TestInvoices:
    def test_list_invoices(self, client):
        r = client.get(f"{API}/invoices", params={"shop_id": "shop-1"})
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert len(data) > 0

    def test_invoice_status_filter(self, client):
        r = client.get(f"{API}/invoices", params={"shop_id": "shop-1", "status": "paid"})
        assert r.status_code == 200
        assert all(i["status"] == "paid" for i in r.json())

    def test_get_invoice_by_id(self, client):
        lst = client.get(f"{API}/invoices", params={"shop_id": "shop-1"}).json()
        iid = lst[0]["id"]
        r = client.get(f"{API}/invoices/{iid}")
        assert r.status_code == 200
        _no_id(r.json())

    def test_create_invoice_decrements_stock(self, client):
        # pick a product
        prods = client.get(f"{API}/products", params={"shop_id": "shop-1"}).json()
        prod = next(p for p in prods if p["stock"] >= 5)
        pid, before = prod["id"], prod["stock"]
        payload = {
            "shop_id": "shop-1",
            "customer_id": None,
            "customer_name": "Walk-in Customer",
            "items": [{
                "product_id": pid, "name": prod["name"], "quantity": 2,
                "price": prod["selling_price"], "discount": 0, "gst": prod["gst"],
                "subtotal": prod["selling_price"] * 2,
            }],
            "subtotal": prod["selling_price"] * 2 * 100 / (100 + prod["gst"]),
            "discount": 0,
            "gst": prod["selling_price"] * 2 * prod["gst"] / (100 + prod["gst"]),
            "total": prod["selling_price"] * 2,
            "amount_paid": prod["selling_price"] * 2,
            "balance_due": 0,
            "payment_method": "cash",
            "status": "paid",
        }
        r = client.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_id(data)
        assert data["invoice_number"].startswith("INV-2026-")
        assert len(data["invoice_number"]) == len("INV-2026-00001")
        # Verify stock decrement
        after = client.get(f"{API}/products/{pid}").json()["stock"]
        assert after == before - 2, f"Stock not decremented: {before} -> {after}"

    def test_create_invoice_updates_customer(self, client):
        cust_payload = {"shop_id": "shop-1", "name": "TEST_InvCust", "phone": "+91 9111111111"}
        cust = client.post(f"{API}/customers", json=cust_payload).json()
        cid = cust["id"]
        prods = client.get(f"{API}/products", params={"shop_id": "shop-1"}).json()
        prod = next(p for p in prods if p["stock"] >= 2)
        payload = {
            "shop_id": "shop-1", "customer_id": cid, "customer_name": cust["name"],
            "items": [{"product_id": prod["id"], "name": prod["name"], "quantity": 1,
                       "price": prod["selling_price"], "discount": 0,
                       "gst": prod["gst"], "subtotal": prod["selling_price"]}],
            "subtotal": prod["selling_price"], "discount": 0, "gst": 0,
            "total": prod["selling_price"], "amount_paid": prod["selling_price"],
            "balance_due": 0, "payment_method": "cash", "status": "paid",
        }
        r = client.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200
        got = client.get(f"{API}/customers/{cid}").json()
        assert got["total_purchases"] >= prod["selling_price"]
        assert got.get("last_purchase")


# ---------- EXPENSES ----------
class TestExpenses:
    def test_list_expenses(self, client):
        r = client.get(f"{API}/expenses", params={"shop_id": "shop-1"})
        assert r.status_code == 200
        _no_id(r.json())

    def test_create_expense(self, client):
        payload = {"shop_id": "shop-1", "category": "Rent",
                   "description": "TEST_expense", "amount": 5000, "payment_method": "cash"}
        r = client.post(f"{API}/expenses", json=payload)
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert data["id"] and data["date"]


# ---------- TRANSFERS ----------
class TestTransfers:
    def test_list_transfers(self, client):
        r = client.get(f"{API}/transfers")
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert len(data) > 0

    def test_list_transfers_shop_filter(self, client):
        r = client.get(f"{API}/transfers", params={"shop_id": "shop-1"})
        assert r.status_code == 200
        data = r.json()
        for t in data:
            assert t["from_shop_id"] == "shop-1" or t["to_shop_id"] == "shop-1"

    def test_create_transfer(self, client):
        prods = client.get(f"{API}/products", params={"shop_id": "shop-1"}).json()
        prod = prods[0]
        payload = {
            "from_shop_id": "shop-1", "to_shop_id": "shop-2",
            "product_id": prod["id"], "product_name": prod["name"],
            "quantity": 1, "remarks": "TEST_transfer",
        }
        r = client.post(f"{API}/transfers", json=payload)
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        assert data["transfer_number"].startswith("TRF-")
        assert data["status"] == "pending"


# ---------- GST REPORT ----------
class TestGSTReport:
    def test_gst_report_shop_1(self, client):
        r = client.get(f"{API}/reports/gst/shop-1")
        assert r.status_code == 200
        data = r.json()
        _no_id(data)
        for k in ("taxable_sales", "cgst", "sgst", "igst", "total_gst", "gst_invoices"):
            assert k in data
        # cgst + sgst == total_gst
        assert abs((data["cgst"] + data["sgst"]) - data["total_gst"]) < 0.01
        assert data["igst"] == 0


# ---------- SEED ----------
class TestSeed:
    def test_seed_and_counts(self, client):
        r = client.post(f"{API}/seed")
        assert r.status_code == 200
        data = r.json()
        assert data["shops"] == 2
        assert data["products"] >= 70
        assert data["customers"] == 150
        assert data["invoices"] >= 500
        assert data["expenses"] >= 20
        assert data["transfers"] >= 50
