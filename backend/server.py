from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="RetailPrime ERP")
api_router = APIRouter(prefix="/api")


# ---------- MODELS ----------
class Shop(BaseModel):
    id: str
    name: str
    location: str
    phone: str
    gstin: str
    address: str
    status: str = "active"


class Product(BaseModel):
    id: str
    shop_id: str
    name: str
    brand: str
    category: str
    sku: str
    barcode: str
    hsn: str
    cost_price: float
    selling_price: float
    gst: float
    stock: int
    min_stock: int
    supplier: Optional[str] = None
    image: Optional[str] = None
    is_accessory: bool = False


class Customer(BaseModel):
    id: str
    shop_id: str
    name: str
    phone: str
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    total_purchases: float = 0
    total_paid: float = 0
    total_due: float = 0
    last_purchase: Optional[str] = None


class InvoiceItem(BaseModel):
    product_id: str
    name: str
    quantity: int
    price: float
    discount: float = 0
    gst: float = 0
    subtotal: float


class Invoice(BaseModel):
    id: str
    invoice_number: str
    shop_id: str
    customer_id: Optional[str] = None
    customer_name: str
    items: List[InvoiceItem]
    subtotal: float
    discount: float
    gst: float
    total: float
    amount_paid: float
    balance_due: float
    payment_method: str
    status: str  # paid, partial, due
    created_at: str


class Expense(BaseModel):
    id: str
    shop_id: str
    category: str
    description: str
    amount: float
    payment_method: str
    date: str


class StockTransfer(BaseModel):
    id: str
    transfer_number: str
    from_shop_id: str
    to_shop_id: str
    product_id: str
    product_name: str
    quantity: int
    status: str
    remarks: Optional[str] = None
    created_at: str


# ---------- HELPERS ----------
def clean(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ---------- SHOPS ----------
@api_router.get("/shops")
async def list_shops():
    shops = await db.shops.find({}, {"_id": 0}).to_list(100)
    # Compute stats per shop
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    for s in shops:
        invoices = await db.invoices.find({"shop_id": s["id"]}, {"_id": 0}).to_list(10000)
        today_inv = [i for i in invoices if datetime.fromisoformat(i["created_at"]) >= today_start]
        s["today_sales"] = sum(i["total"] for i in today_inv)
        s["today_invoices"] = len(today_inv)
        products = await db.products.count_documents({"shop_id": s["id"]})
        low = await db.products.count_documents({"shop_id": s["id"], "$expr": {"$lte": ["$stock", "$min_stock"]}})
        s["products"] = products
        s["low_stock"] = low
        # 7-day trend
        trend = []
        for d in range(6, -1, -1):
            day_start = (datetime.now(timezone.utc) - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            day_sales = sum(i["total"] for i in invoices if day_start <= datetime.fromisoformat(i["created_at"]) < day_end)
            trend.append(day_sales)
        s["trend"] = trend
    return shops


# ---------- DASHBOARD ----------
@api_router.get("/dashboard/{shop_id}")
async def dashboard(shop_id: str):
    shop_filter = {} if shop_id == "all" else {"shop_id": shop_id}
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    month_start = today.replace(day=1)

    invoices = await db.invoices.find(shop_filter, {"_id": 0}).to_list(50000)
    products = await db.products.find(shop_filter, {"_id": 0}).to_list(10000)
    customers_count = await db.customers.count_documents(shop_filter)

    def sales_in(start, end):
        return [i for i in invoices if start <= datetime.fromisoformat(i["created_at"]) < end]

    today_inv = sales_in(today, today + timedelta(days=1))
    yesterday_inv = sales_in(yesterday, today)
    month_inv = sales_in(month_start, today + timedelta(days=1))

    def profit_of(invs):
        p = 0
        prod_map = {p["id"]: p for p in products}
        for inv in invs:
            for item in inv["items"]:
                prod = prod_map.get(item["product_id"])
                if prod:
                    p += (item["price"] - prod["cost_price"]) * item["quantity"]
        return p

    today_sales = sum(i["total"] for i in today_inv)
    yest_sales = sum(i["total"] for i in yesterday_inv)
    today_profit = profit_of(today_inv)
    yest_profit = profit_of(yesterday_inv)
    outstanding = sum(i["balance_due"] for i in invoices if i["balance_due"] > 0)
    due_customers = len(set(i["customer_id"] for i in invoices if i["balance_due"] > 0 and i.get("customer_id")))
    monthly_revenue = sum(i["total"] for i in month_inv)
    low_stock = len([p for p in products if p["stock"] <= p["min_stock"]])
    out_stock = len([p for p in products if p["stock"] == 0])

    # 30-day trend
    trend_30 = []
    for d in range(29, -1, -1):
        day = today - timedelta(days=d)
        day_inv = sales_in(day, day + timedelta(days=1))
        trend_30.append({
            "date": day.strftime("%d %b"),
            "revenue": sum(i["total"] for i in day_inv),
            "profit": profit_of(day_inv),
            "orders": len(day_inv),
        })

    # Top products
    product_sales: Dict[str, Dict[str, Any]] = {}
    prod_map = {p["id"]: p for p in products}
    for inv in month_inv:
        for item in inv["items"]:
            pid = item["product_id"]
            if pid not in product_sales:
                prod = prod_map.get(pid, {})
                product_sales[pid] = {
                    "id": pid,
                    "name": item["name"],
                    "brand": prod.get("brand", ""),
                    "units": 0,
                    "revenue": 0,
                    "profit": 0,
                }
            product_sales[pid]["units"] += item["quantity"]
            product_sales[pid]["revenue"] += item["subtotal"]
            prod = prod_map.get(pid)
            if prod:
                product_sales[pid]["profit"] += (item["price"] - prod["cost_price"]) * item["quantity"]
    top_products = sorted(product_sales.values(), key=lambda x: x["revenue"], reverse=True)[:5]

    # Category breakdown
    cat_rev: Dict[str, float] = {}
    for inv in month_inv:
        for item in inv["items"]:
            prod = prod_map.get(item["product_id"])
            if prod:
                cat_rev[prod["category"]] = cat_rev.get(prod["category"], 0) + item["subtotal"]
    categories = [{"name": k, "value": v} for k, v in sorted(cat_rev.items(), key=lambda x: x[1], reverse=True)]

    # Low stock items
    low_items = sorted([p for p in products if p["stock"] <= p["min_stock"]], key=lambda x: x["stock"])[:8]

    # Recent invoices
    recent = sorted(invoices, key=lambda x: x["created_at"], reverse=True)[:8]

    # Outstanding customers
    cust_due = [i for i in invoices if i["balance_due"] > 0]
    cust_due = sorted(cust_due, key=lambda x: x["balance_due"], reverse=True)[:6]

    def pct(cur, prev):
        if prev == 0:
            return 100.0 if cur > 0 else 0.0
        return round((cur - prev) / prev * 100, 1)

    return {
        "kpis": {
            "today_sales": today_sales,
            "today_sales_change": pct(today_sales, yest_sales),
            "today_profit": today_profit,
            "today_profit_change": pct(today_profit, yest_profit),
            "today_orders": len(today_inv),
            "total_customers": customers_count,
            "total_products": len(products),
            "low_stock": low_stock,
            "out_stock": out_stock,
            "outstanding": outstanding,
            "due_customers": due_customers,
            "monthly_revenue": monthly_revenue,
        },
        "trend_30": trend_30,
        "top_products": top_products,
        "categories": categories,
        "low_stock_items": low_items,
        "recent_invoices": recent,
        "outstanding_invoices": cust_due,
    }


# ---------- PRODUCTS ----------
@api_router.get("/products")
async def list_products(shop_id: str = Query(...), category: Optional[str] = None, search: Optional[str] = None, is_accessory: Optional[bool] = None):
    q: Dict[str, Any] = {}
    if shop_id != "all":
        q["shop_id"] = shop_id
    if category:
        q["category"] = category
    if is_accessory is not None:
        q["is_accessory"] = is_accessory
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}},
        ]
    products = await db.products.find(q, {"_id": 0}).to_list(5000)
    return products


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    return p


@api_router.post("/products")
async def create_product(payload: Dict[str, Any]):
    payload["id"] = str(uuid.uuid4())
    await db.products.insert_one(dict(payload))
    return clean(payload)


# ---------- CUSTOMERS ----------
@api_router.get("/customers")
async def list_customers(shop_id: str = Query(...), search: Optional[str] = None):
    q: Dict[str, Any] = {} if shop_id == "all" else {"shop_id": shop_id}
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    customers = await db.customers.find(q, {"_id": 0}).to_list(5000)
    return customers


@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str):
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Not found")
    invoices = await db.invoices.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    c["invoices"] = invoices
    return c


@api_router.post("/customers")
async def create_customer(payload: Dict[str, Any]):
    payload["id"] = str(uuid.uuid4())
    payload.setdefault("total_purchases", 0)
    payload.setdefault("total_paid", 0)
    payload.setdefault("total_due", 0)
    await db.customers.insert_one(dict(payload))
    return clean(payload)


# ---------- INVOICES ----------
@api_router.get("/invoices")
async def list_invoices(shop_id: str = Query(...), status: Optional[str] = None, search: Optional[str] = None):
    q: Dict[str, Any] = {} if shop_id == "all" else {"shop_id": shop_id}
    if status:
        q["status"] = status
    if search:
        q["$or"] = [
            {"invoice_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
        ]
    inv = await db.invoices.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return inv


@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Not found")
    return inv


@api_router.post("/invoices")
async def create_invoice(payload: Dict[str, Any]):
    payload["id"] = str(uuid.uuid4())
    # generate invoice number
    count = await db.invoices.count_documents({})
    payload["invoice_number"] = f"INV-2026-{(count+1):05d}"
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    # decrement stock
    for item in payload.get("items", []):
        await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": -item["quantity"]}})
    # update customer
    if payload.get("customer_id"):
        await db.customers.update_one(
            {"id": payload["customer_id"]},
            {"$inc": {
                "total_purchases": payload["total"],
                "total_paid": payload["amount_paid"],
                "total_due": payload["balance_due"],
            }, "$set": {"last_purchase": payload["created_at"]}}
        )
    await db.invoices.insert_one(dict(payload))
    return clean(payload)


# ---------- EXPENSES ----------
@api_router.get("/expenses")
async def list_expenses(shop_id: str = Query(...)):
    q = {} if shop_id == "all" else {"shop_id": shop_id}
    return await db.expenses.find(q, {"_id": 0}).sort("date", -1).to_list(1000)


@api_router.post("/expenses")
async def create_expense(payload: Dict[str, Any]):
    payload["id"] = str(uuid.uuid4())
    payload.setdefault("date", datetime.now(timezone.utc).isoformat())
    await db.expenses.insert_one(dict(payload))
    return clean(payload)


# ---------- STOCK TRANSFER ----------
@api_router.get("/transfers")
async def list_transfers(shop_id: Optional[str] = None):
    q: Dict[str, Any] = {}
    if shop_id and shop_id != "all":
        q = {"$or": [{"from_shop_id": shop_id}, {"to_shop_id": shop_id}]}
    return await db.transfers.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/transfers")
async def create_transfer(payload: Dict[str, Any]):
    payload["id"] = str(uuid.uuid4())
    count = await db.transfers.count_documents({})
    payload["transfer_number"] = f"TRF-{(count+1):04d}"
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    payload.setdefault("status", "pending")
    await db.transfers.insert_one(dict(payload))
    return clean(payload)


# ---------- REPORTS ----------
@api_router.get("/reports/gst/{shop_id}")
async def gst_report(shop_id: str):
    q = {} if shop_id == "all" else {"shop_id": shop_id}
    invoices = await db.invoices.find(q, {"_id": 0}).to_list(50000)
    taxable = sum(i["subtotal"] for i in invoices)
    total_gst = sum(i["gst"] for i in invoices)
    cgst = total_gst / 2
    sgst = total_gst / 2
    return {
        "taxable_sales": taxable,
        "cgst": cgst,
        "sgst": sgst,
        "igst": 0,
        "total_gst": total_gst,
        "gst_invoices": len(invoices),
    }


# ---------- SEED ----------
@api_router.post("/seed")
async def seed_data():
    # Clear existing
    for c in ["shops", "products", "customers", "invoices", "expenses", "transfers"]:
        await db[c].delete_many({})

    shops = [
        {"id": "shop-1", "name": "Poonamallee", "location": "Chennai West", "phone": "+91 98400 12345", "gstin": "33ABCDE1234F1Z5", "address": "12, Bangalore Highway, Poonamallee, Chennai 600056", "status": "active"},
        {"id": "shop-2", "name": "Kundrathur", "location": "Chennai South-West", "phone": "+91 98400 67890", "gstin": "33ABCDE1234F2Z4", "address": "45, Main Road, Kundrathur, Chennai 600069", "status": "active"},
    ]
    await db.shops.insert_many([dict(s) for s in shops])

    categories = {
        "Smartphones": [
            ("Samsung Galaxy A15", "Samsung", 12500, 15499, 18),
            ("Samsung Galaxy A25", "Samsung", 17500, 21999, 18),
            ("Samsung Galaxy S24 FE", "Samsung", 42000, 49999, 18),
            ("Redmi Note 14", "Redmi", 14200, 17999, 18),
            ("Redmi 13C", "Redmi", 8500, 10999, 18),
            ("OnePlus Nord CE 4", "OnePlus", 22500, 26999, 18),
            ("OnePlus 13R", "OnePlus", 38500, 44999, 18),
            ("Vivo Y28", "Vivo", 13500, 16499, 18),
            ("Oppo A79", "Oppo", 15500, 18999, 18),
            ("Realme C67", "Realme", 11500, 13999, 18),
            ("iPhone 15", "Apple", 62000, 72999, 18),
            ("iPhone 13", "Apple", 44000, 51999, 18),
        ],
        "Chargers": [
            ("Jio 10W Charger", "Jio", 180, 349, 18),
            ("Samsung 25W Fast Charger", "Samsung", 850, 1299, 18),
            ("Apple 20W USB-C Charger", "Apple", 1400, 1999, 18),
            ("Realme Dart 65W Charger", "Realme", 950, 1399, 18),
        ],
        "Cables": [
            ("Type-C Fast Charging Cable", "Local", 60, 199, 18),
            ("Lightning Cable 1m", "Apple", 700, 999, 18),
            ("USB Cable Micro", "Local", 40, 149, 18),
            ("Type-C to Type-C 60W", "Local", 180, 399, 18),
        ],
        "Earphones": [
            ("Boat Bassheads 100", "Boat", 350, 599, 18),
            ("Realme Buds Air 5", "Realme", 1800, 2499, 18),
            ("Samsung Galaxy Buds FE", "Samsung", 3800, 4999, 18),
            ("OnePlus Bullets Z2", "OnePlus", 1200, 1599, 18),
        ],
        "Power Banks": [
            ("Mi 10000mAh Power Bank", "Mi", 900, 1299, 18),
            ("Realme 20000mAh Power Bank", "Realme", 1700, 2299, 18),
            ("Ambrane 10000mAh Power Bank", "Ambrane", 650, 999, 18),
        ],
        "Smart Watches": [
            ("Boat Wave Call", "Boat", 1400, 1999, 18),
            ("Noise ColorFit Pulse", "Noise", 1500, 2199, 18),
            ("Fire-Boltt Ninja Call Pro", "Fire-Boltt", 1300, 1899, 18),
        ],
        "Cases": [
            ("Silicone Case A15", "Local", 80, 249, 18),
            ("Leather Case iPhone 15", "Local", 350, 799, 18),
            ("Transparent Cover Redmi 13C", "Local", 60, 149, 18),
        ],
        "Screen Protectors": [
            ("Tempered Glass A15", "Local", 40, 149, 18),
            ("Tempered Glass iPhone 15", "Local", 60, 199, 18),
            ("Privacy Glass S24", "Local", 90, 249, 18),
        ],
    }

    products = []
    for shop in shops:
        for cat, items in categories.items():
            for name, brand, cost, sell, gst in items:
                is_acc = cat != "Smartphones"
                stock = random.randint(2, 45) if is_acc else random.randint(0, 15)
                min_stock = 5 if is_acc else 3
                pid = str(uuid.uuid4())
                products.append({
                    "id": pid,
                    "shop_id": shop["id"],
                    "name": name,
                    "brand": brand,
                    "category": cat,
                    "sku": f"SKU-{random.randint(10000,99999)}",
                    "barcode": f"890{random.randint(1000000000, 9999999999)}",
                    "hsn": "8517" if cat == "Smartphones" else "8504",
                    "cost_price": cost,
                    "selling_price": sell,
                    "gst": gst,
                    "stock": stock,
                    "min_stock": min_stock,
                    "supplier": "Metro Distributors",
                    "is_accessory": is_acc,
                })
    await db.products.insert_many(products)

    # Customers
    names = ["Ramesh Kumar", "Suresh Babu", "Priya Sundaram", "Karthik Raja", "Rajesh Iyer",
             "Arjun Menon", "Divya Krishnan", "Naveen Prabhu", "Vignesh Ravi", "Santhosh Kumar",
             "Meena Lakshmi", "Ravi Chandran", "Deepa Balaji", "Kannan Subramaniam", "Anitha Rao",
             "Manoj Pillai", "Sudha Ramachandran", "Vijay Anand", "Kavitha Selvi", "Prakash Nair",
             "Lakshmi Devi", "Bala Murugan", "Shanthi Kumari", "Ganesh Kumar", "Uma Maheswari",
             "Senthil Vel", "Jaya Prakash", "Nithya Sri", "Muthu Kumar", "Radhika Iyer"]
    customers = []
    for i, nm in enumerate(names * 5):  # 150 customers
        cid = str(uuid.uuid4())
        customers.append({
            "id": cid,
            "shop_id": random.choice(shops)["id"],
            "name": nm,
            "phone": f"+91 9{random.randint(100000000, 999999999)}",
            "email": f"{nm.lower().replace(' ', '.')}{i}@gmail.com",
            "gstin": f"33{random.choice(['ABCDE','FGHIJ','KLMNO'])}{random.randint(1000,9999)}F1Z{random.randint(1,9)}" if i % 4 == 0 else None,
            "address": f"{random.randint(1,99)}, Main St, Chennai",
            "total_purchases": 0,
            "total_paid": 0,
            "total_due": 0,
        })
    await db.customers.insert_many(customers)

    # Invoices (last 90 days)
    payment_methods = ["cash", "upi", "card", "pay_later"]
    invoices = []
    inv_counter = 0
    for d in range(89, -1, -1):
        base_day = datetime.now(timezone.utc) - timedelta(days=d)
        daily_count = random.randint(3, 12)
        for _ in range(daily_count):
            inv_counter += 1
            hour = random.randint(9, 20)
            minute = random.randint(0, 59)
            when = base_day.replace(hour=hour, minute=minute, second=0, microsecond=0)
            shop = random.choice(shops)
            shop_products = [p for p in products if p["shop_id"] == shop["id"]]
            n_items = random.randint(1, 4)
            items = []
            subtotal = 0
            gst_total = 0
            for _ in range(n_items):
                prod = random.choice(shop_products)
                qty = random.randint(1, 2) if not prod["is_accessory"] else random.randint(1, 3)
                price = prod["selling_price"]
                item_sub = qty * price
                item_gst = item_sub * prod["gst"] / (100 + prod["gst"])
                items.append({
                    "product_id": prod["id"],
                    "name": prod["name"],
                    "quantity": qty,
                    "price": price,
                    "discount": 0,
                    "gst": prod["gst"],
                    "subtotal": item_sub,
                })
                subtotal += item_sub - item_gst
                gst_total += item_gst
            total = subtotal + gst_total
            customer = random.choice(customers) if random.random() > 0.15 else None
            method = random.choice(payment_methods)
            if method == "pay_later":
                paid = round(total * random.choice([0, 0.3, 0.5]), 2)
                status = "partial" if paid > 0 else "due"
            else:
                paid = total
                status = "paid"
            invoices.append({
                "id": str(uuid.uuid4()),
                "invoice_number": f"INV-2026-{inv_counter:05d}",
                "shop_id": shop["id"],
                "customer_id": customer["id"] if customer else None,
                "customer_name": customer["name"] if customer else "Walk-in Customer",
                "items": items,
                "subtotal": round(subtotal, 2),
                "discount": 0,
                "gst": round(gst_total, 2),
                "total": round(total, 2),
                "amount_paid": round(paid, 2),
                "balance_due": round(total - paid, 2),
                "payment_method": method,
                "status": status,
                "created_at": when.isoformat(),
            })
    await db.invoices.insert_many(invoices)

    # Update customer totals
    for c in customers:
        related = [i for i in invoices if i["customer_id"] == c["id"]]
        c["total_purchases"] = sum(i["total"] for i in related)
        c["total_paid"] = sum(i["amount_paid"] for i in related)
        c["total_due"] = sum(i["balance_due"] for i in related)
        if related:
            c["last_purchase"] = max(i["created_at"] for i in related)
        await db.customers.update_one({"id": c["id"]}, {"$set": {
            "total_purchases": c["total_purchases"],
            "total_paid": c["total_paid"],
            "total_due": c["total_due"],
            "last_purchase": c.get("last_purchase"),
        }})

    # Expenses
    exp_cats = ["Rent", "Electricity", "Staff Salary", "Transport", "Supplier Payment", "Maintenance", "Marketing"]
    expenses = []
    for d in range(60, -1, -1):
        if random.random() > 0.4:
            when = datetime.now(timezone.utc) - timedelta(days=d)
            expenses.append({
                "id": str(uuid.uuid4()),
                "shop_id": random.choice(shops)["id"],
                "category": random.choice(exp_cats),
                "description": f"{random.choice(exp_cats)} for the week",
                "amount": random.choice([1500, 2500, 5000, 8500, 12000, 25000, 45000]),
                "payment_method": random.choice(["cash", "upi", "bank_transfer"]),
                "date": when.isoformat(),
            })
    await db.expenses.insert_many(expenses)

    # Stock transfers
    transfers = []
    for i in range(1, 55):
        from_shop = random.choice(shops)
        to_shop = shops[0] if from_shop["id"] == shops[1]["id"] else shops[1]
        prod = random.choice([p for p in products if p["shop_id"] == from_shop["id"]])
        transfers.append({
            "id": str(uuid.uuid4()),
            "transfer_number": f"TRF-{i:04d}",
            "from_shop_id": from_shop["id"],
            "to_shop_id": to_shop["id"],
            "product_id": prod["id"],
            "product_name": prod["name"],
            "quantity": random.randint(1, 8),
            "status": random.choice(["completed", "completed", "completed", "in_transit", "pending"]),
            "remarks": "Balancing stock",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 60))).isoformat(),
        })
    await db.transfers.insert_many(transfers)

    return {
        "shops": len(shops),
        "products": len(products),
        "customers": len(customers),
        "invoices": len(invoices),
        "expenses": len(expenses),
        "transfers": len(transfers),
    }


@api_router.get("/")
async def root():
    return {"app": "RetailPrime ERP", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
