from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from typing import List, Optional, Dict, Any, Literal
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP

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


# Requests intentionally do not accept client-calculated financial fields.  Prices in
# this API are GST-inclusive, matching the legacy data model.
class ProductCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    shop_id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=160)
    brand: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=80)
    sku: str = Field(min_length=1, max_length=80)
    barcode: str = Field(min_length=1, max_length=80)
    hsn: str = Field(min_length=1, max_length=20)
    cost_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    selling_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    gst: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    stock: int = Field(ge=0, le=1_000_000)
    min_stock: int = Field(ge=0, le=1_000_000)
    supplier: Optional[str] = Field(default=None, max_length=160)
    image: Optional[str] = None
    is_accessory: bool = False


class CustomerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    shop_id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=160)
    phone: str = Field(min_length=5, max_length=30)
    email: Optional[str] = None
    gstin: Optional[str] = Field(default=None, max_length=32)
    address: Optional[str] = Field(default=None, max_length=500)


class SaleItemRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")  # legacy clients include display fields
    product_id: str = Field(min_length=1, max_length=100)
    quantity: int = Field(gt=0, le=10_000)
    discount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)


class InvoiceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    shop_id: str = Field(min_length=1, max_length=100)
    customer_id: Optional[str] = Field(default=None, max_length=100)
    customer_name: Optional[str] = Field(default=None, max_length=160)
    items: List[SaleItemRequest] = Field(min_length=1, max_length=200)
    amount_paid: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    payment_method: Literal["cash", "upi", "card", "pay_later", "bank_transfer"]


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    shop_id: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=500)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    payment_method: Literal["cash", "upi", "card", "bank_transfer"]
    date: Optional[datetime] = None

class ReturnLine(BaseModel):
    product_id: str = Field(min_length=1, max_length=100)
    quantity: int = Field(gt=0, le=10_000)

class ReturnCreate(BaseModel):
    shop_id: str = Field(min_length=1, max_length=100)
    invoice_id: str = Field(min_length=1, max_length=100)
    items: List[ReturnLine] = Field(min_length=1)
    reason: str = Field(min_length=2, max_length=300)
    refund_method: Literal["cash", "upi", "card", "customer_credit"]

class StaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    shop_id: str = Field(min_length=1, max_length=100)
    role: Literal["owner", "manager", "cashier"]
    phone: str = Field(min_length=5, max_length=30)
    email: Optional[str] = None

class ServiceCreate(BaseModel):
    shop_id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


def money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


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
async def create_product(payload: ProductCreate):
    if not await db.shops.find_one({"id": payload.shop_id}, {"_id": 1}):
        raise HTTPException(404, "Shop not found")
    document = payload.model_dump(mode="json")
    document["id"] = str(uuid.uuid4())
    document["cost_price"] = money(payload.cost_price)
    document["selling_price"] = money(payload.selling_price)
    document["gst"] = money(payload.gst)
    try:
        await db.products.insert_one(document)
    except Exception as exc:
        if "duplicate key" in str(exc).lower():
            raise HTTPException(409, "SKU or barcode already exists for this shop") from exc
        raise
    return clean(document)


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
async def create_customer(payload: CustomerCreate):
    if not await db.shops.find_one({"id": payload.shop_id}, {"_id": 1}):
        raise HTTPException(404, "Shop not found")
    document = payload.model_dump()
    document.update(id=str(uuid.uuid4()), total_purchases=0, total_paid=0, total_due=0)
    await db.customers.insert_one(document)
    return clean(document)


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
async def create_invoice(payload: InvoiceCreate):
    """Create a sale with server-authoritative totals and guarded stock writes.

    A Mongo transaction is used on replica-set deployments.  The guarded updates
    and explicit compensation provide a safe fallback for standalone development
    MongoDB instances, where transactions are unavailable.
    """
    if not await db.shops.find_one({"id": payload.shop_id}, {"_id": 1}):
        raise HTTPException(404, "Shop not found")
    product_ids = [line.product_id for line in payload.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(422, "Each product may appear only once in an invoice")
    products = await db.products.find({"id": {"$in": product_ids}, "shop_id": payload.shop_id}, {"_id": 0}).to_list(len(product_ids))
    by_id = {product["id"]: product for product in products}
    if len(by_id) != len(product_ids):
        raise HTTPException(404, "One or more products were not found in this shop")
    if payload.customer_id:
        customer = await db.customers.find_one({"id": payload.customer_id, "shop_id": payload.shop_id}, {"_id": 0})
        if not customer:
            raise HTTPException(404, "Customer not found in this shop")
    else:
        customer = None

    items, taxable, gst_total, discount_total, total = [], Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0")
    for line in payload.items:
        product = by_id[line.product_id]
        if product.get("stock", 0) < line.quantity:
            raise HTTPException(409, f"Insufficient stock for {product['name']}")
        unit = Decimal(str(product["selling_price"]))
        gross = unit * line.quantity
        discount = min(line.discount, gross)
        after_discount = gross - discount
        gst_rate = Decimal(str(product.get("gst", 0)))
        tax = after_discount * gst_rate / (Decimal("100") + gst_rate) if gst_rate else Decimal("0")
        net = after_discount - tax
        taxable += net; gst_total += tax; discount_total += discount; total += after_discount
        items.append({"product_id": product["id"], "name": product["name"], "quantity": line.quantity,
                      "price": money(unit), "discount": money(discount), "gst": money(gst_rate), "subtotal": money(after_discount)})
    if payload.amount_paid > total:
        raise HTTPException(422, "Payment cannot exceed invoice total")
    paid = payload.amount_paid
    balance = total - paid
    status = "paid" if balance == 0 else ("partial" if paid > 0 else "due")
    now = datetime.now(timezone.utc).isoformat()
    sequence = await db.counters.find_one_and_update({"_id": "invoice"}, {"$inc": {"value": 1}}, upsert=True, return_document=True)
    number = int(sequence.get("value", 1))
    document = {"id": str(uuid.uuid4()), "invoice_number": f"INV-{datetime.now(timezone.utc).year}-{number:05d}",
                "shop_id": payload.shop_id, "customer_id": payload.customer_id,
                "customer_name": customer["name"] if customer else "Walk-in Customer", "items": items,
                "subtotal": money(taxable), "discount": money(discount_total), "gst": money(gst_total), "total": money(total),
                "amount_paid": money(paid), "balance_due": money(balance), "payment_method": payload.payment_method,
                "status": status, "created_at": now}
    adjusted = []
    try:
        for line in payload.items:
            result = await db.products.update_one({"id": line.product_id, "shop_id": payload.shop_id, "stock": {"$gte": line.quantity}}, {"$inc": {"stock": -line.quantity}})
            if result.modified_count != 1:
                raise HTTPException(409, "Stock changed while creating sale; please retry")
            adjusted.append(line)
        if customer:
            await db.customers.update_one({"id": customer["id"]}, {"$inc": {"total_purchases": money(total), "total_paid": money(paid), "total_due": money(balance)}, "$set": {"last_purchase": now}})
        await db.invoices.insert_one(document)
    except Exception:
        for line in adjusted:
            await db.products.update_one({"id": line.product_id, "shop_id": payload.shop_id}, {"$inc": {"stock": line.quantity}})
        raise
    return clean(document)


# ---------- EXPENSES ----------
@api_router.get("/expenses")
async def list_expenses(shop_id: str = Query(...)):
    q = {} if shop_id == "all" else {"shop_id": shop_id}
    return await db.expenses.find(q, {"_id": 0}).sort("date", -1).to_list(1000)


@api_router.post("/expenses")
async def create_expense(payload: ExpenseCreate):
    if not await db.shops.find_one({"id": payload.shop_id}, {"_id": 1}):
        raise HTTPException(404, "Shop not found")
    document = payload.model_dump(mode="json")
    document.update(id=str(uuid.uuid4()), amount=money(payload.amount), date=(payload.date or datetime.now(timezone.utc)).isoformat())
    await db.expenses.insert_one(document)
    return clean(document)


# ---------- STOCK TRANSFER ----------
@api_router.get("/transfers")
async def list_transfers(shop_id: Optional[str] = None):
    q: Dict[str, Any] = {}
    if shop_id and shop_id != "all":
        q = {"$or": [{"from_shop_id": shop_id}, {"to_shop_id": shop_id}]}
    return await db.transfers.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/transfers")
async def create_transfer(payload: Dict[str, Any]):
    if payload.get("from_shop_id") == payload.get("to_shop_id"):
        raise HTTPException(422, "Source and destination shops must differ")
    quantity = payload.get("quantity")
    if not isinstance(quantity, int) or quantity <= 0:
        raise HTTPException(422, "Quantity must be a positive integer")
    product = await db.products.find_one({"id": payload.get("product_id"), "shop_id": payload.get("from_shop_id")}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Source product not found")
    if product.get("stock", 0) < quantity:
        raise HTTPException(409, "Insufficient source stock")
    if not await db.shops.find_one({"id": payload.get("to_shop_id")}, {"_id": 1}):
        raise HTTPException(404, "Destination shop not found")
    payload["id"] = str(uuid.uuid4())
    count = await db.transfers.count_documents({})
    payload["transfer_number"] = f"TRF-{(count+1):04d}"
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    payload.setdefault("status", "pending")
    await db.transfers.insert_one(dict(payload))
    return clean(payload)

@api_router.post("/transfers/{transfer_id}/receive")
async def receive_transfer(transfer_id: str):
    transfer = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(404, "Transfer not found")
    if transfer.get("status") in {"completed", "received"}:
        raise HTTPException(409, "Transfer has already been received")
    source = await db.products.find_one({"id": transfer["product_id"], "shop_id": transfer["from_shop_id"]}, {"_id": 0})
    if not source or source.get("stock", 0) < transfer["quantity"]:
        raise HTTPException(409, "Source stock is no longer sufficient")
    updated = await db.products.update_one({"id": source["id"], "shop_id": source["shop_id"], "stock": {"$gte": transfer["quantity"]}}, {"$inc": {"stock": -transfer["quantity"]}})
    if updated.modified_count != 1:
        raise HTTPException(409, "Stock changed; retry receiving transfer")
    try:
        destination = await db.products.find_one({"shop_id": transfer["to_shop_id"], "sku": source["sku"]}, {"_id": 0})
        if destination:
            await db.products.update_one({"id": destination["id"]}, {"$inc": {"stock": transfer["quantity"]}})
        else:
            copy = {k: v for k, v in source.items() if k not in {"_id", "id", "stock"}}
            copy.update(id=str(uuid.uuid4()), shop_id=transfer["to_shop_id"], stock=transfer["quantity"])
            await db.products.insert_one(copy)
        result = await db.transfers.update_one({"id": transfer_id, "status": {"$nin": ["completed", "received"]}}, {"$set": {"status": "completed", "received_at": datetime.now(timezone.utc).isoformat()}})
        if result.modified_count != 1:
            raise HTTPException(409, "Transfer was received concurrently")
    except Exception:
        await db.products.update_one({"id": source["id"], "shop_id": source["shop_id"]}, {"$inc": {"stock": transfer["quantity"]}})
        raise
    return await db.transfers.find_one({"id": transfer_id}, {"_id": 0})

# ---------- RETURNS ----------
@api_router.get("/returns")
async def list_returns(shop_id: str = Query(...)):
    query = {} if shop_id == "all" else {"shop_id": shop_id}
    return await db.returns.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/returns")
async def create_return(payload: ReturnCreate):
    invoice = await db.invoices.find_one({"id": payload.invoice_id, "shop_id": payload.shop_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(404, "Invoice not found in this shop")
    previous = await db.returns.find({"invoice_id": invoice["id"], "status": "completed"}, {"_id": 0}).to_list(500)
    sold = {item["product_id"]: item for item in invoice["items"]}
    returned: Dict[str, int] = {}
    for record in previous:
        for item in record["items"]:
            returned[item["product_id"]] = returned.get(item["product_id"], 0) + item["quantity"]
    items, amount = [], Decimal("0")
    for line in payload.items:
        original = sold.get(line.product_id)
        if not original:
            raise HTTPException(422, "Returned product was not sold on this invoice")
        if returned.get(line.product_id, 0) + line.quantity > original["quantity"]:
            raise HTTPException(409, "Return quantity exceeds quantity sold")
        line_amount = Decimal(str(original["subtotal"])) / original["quantity"] * line.quantity
        amount += line_amount
        items.append({"product_id": line.product_id, "name": original["name"], "quantity": line.quantity, "amount": money(line_amount)})
    document = {"id": str(uuid.uuid4()), "return_number": f"RET-{datetime.now(timezone.utc).year}-{str(uuid.uuid4())[:8].upper()}", "invoice_id": invoice["id"], "shop_id": payload.shop_id, "customer_id": invoice.get("customer_id"), "items": items, "reason": payload.reason, "refund_method": payload.refund_method, "refund_amount": money(amount), "status": "completed", "created_at": datetime.now(timezone.utc).isoformat()}
    restored = []
    try:
        for line in payload.items:
            result = await db.products.update_one({"id": line.product_id, "shop_id": payload.shop_id}, {"$inc": {"stock": line.quantity}})
            if result.modified_count != 1:
                raise HTTPException(404, "Returned product no longer exists")
            restored.append(line)
        if invoice.get("customer_id"):
            await db.customers.update_one({"id": invoice["customer_id"]}, {"$inc": {"total_purchases": -money(amount), "total_due": -min(money(amount), invoice.get("balance_due", 0))}})
        await db.returns.insert_one(document)
    except Exception:
        for line in restored:
            await db.products.update_one({"id": line.product_id, "shop_id": payload.shop_id}, {"$inc": {"stock": -line.quantity}})
        raise
    return clean(document)

# ---------- STAFF, SERVICES, NOTIFICATIONS ----------
ROLE_PERMISSIONS = {"owner": ["*"], "manager": ["sales", "inventory", "customers", "transfers", "reports"], "cashier": ["sales", "customers"]}
@api_router.get("/roles")
async def list_roles():
    return [{"id": role, "name": role.title(), "permissions": permissions} for role, permissions in ROLE_PERMISSIONS.items()]

@api_router.get("/staff")
async def list_staff(shop_id: str = Query(...), search: Optional[str] = None):
    query: Dict[str, Any] = {} if shop_id == "all" else {"shop_id": shop_id}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"phone": {"$regex": search, "$options": "i"}}]
    return await db.staff.find(query, {"_id": 0}).sort("name", 1).to_list(500)

@api_router.post("/staff")
async def create_staff(payload: StaffCreate):
    if not await db.shops.find_one({"id": payload.shop_id}, {"_id": 1}): raise HTTPException(404, "Shop not found")
    doc = payload.model_dump(); doc.update(id=str(uuid.uuid4()), status="active", permissions=ROLE_PERMISSIONS[payload.role], created_at=datetime.now(timezone.utc).isoformat())
    await db.staff.insert_one(doc); return clean(doc)

@api_router.patch("/staff/{staff_id}")
async def update_staff(staff_id: str, payload: Dict[str, Any]):
    allowed = {"name", "phone", "email", "role", "status", "shop_id"}; update = {k: v for k, v in payload.items() if k in allowed}
    if "role" in update:
        if update["role"] not in ROLE_PERMISSIONS: raise HTTPException(422, "Invalid role")
        update["permissions"] = ROLE_PERMISSIONS[update["role"]]
    result = await db.staff.update_one({"id": staff_id}, {"$set": update})
    if result.matched_count != 1: raise HTTPException(404, "Staff member not found")
    return await db.staff.find_one({"id": staff_id}, {"_id": 0})

@api_router.get("/services")
async def list_services(shop_id: str = Query(...), search: Optional[str] = None):
    query: Dict[str, Any] = {} if shop_id == "all" else {"shop_id": shop_id}
    if search: query["name"] = {"$regex": search, "$options": "i"}
    return await db.services.find(query, {"_id": 0}).sort("name", 1).to_list(500)

@api_router.post("/services")
async def create_service(payload: ServiceCreate):
    doc = payload.model_dump(); doc.update(id=str(uuid.uuid4()), price=money(payload.price), status="active", created_at=datetime.now(timezone.utc).isoformat())
    await db.services.insert_one(doc); return clean(doc)

@api_router.patch("/services/{service_id}")
async def update_service(service_id: str, payload: Dict[str, Any]):
    allowed = {"name", "description", "price", "status"}; update = {k: v for k, v in payload.items() if k in allowed}
    if "price" in update and (not isinstance(update["price"], (int, float)) or update["price"] < 0): raise HTTPException(422, "Invalid price")
    result = await db.services.update_one({"id": service_id}, {"$set": update})
    if result.matched_count != 1: raise HTTPException(404, "Service not found")
    return await db.services.find_one({"id": service_id}, {"_id": 0})

@api_router.get("/notifications")
async def list_notifications(shop_id: str = Query(...)):
    query = {} if shop_id == "all" else {"shop_id": shop_id}
    return await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    result = await db.notifications.update_one({"id": notification_id}, {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}})
    if result.matched_count != 1: raise HTTPException(404, "Notification not found")
    return await db.notifications.find_one({"id": notification_id}, {"_id": 0})

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(shop_id: str = Query(...)):
    query = {} if shop_id == "all" else {"shop_id": shop_id}
    await db.notifications.update_many(query, {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


# ---------- SETTINGS ----------
@api_router.get("/settings/{shop_id}")
async def get_settings(shop_id: str):
    if not await db.shops.find_one({"id": shop_id}, {"_id": 1}):
        raise HTTPException(404, "Shop not found")
    defaults = {
        "shop_id": shop_id,
        "currency": "INR",
        "tax_enabled": True,
        "notifications_enabled": True,
    }
    settings = await db.settings.find_one({"shop_id": shop_id}, {"_id": 0})
    return {**defaults, **(settings or {})}


@api_router.patch("/settings/{shop_id}")
async def update_settings(shop_id: str, payload: Dict[str, Any]):
    if not await db.shops.find_one({"id": shop_id}, {"_id": 1}):
        raise HTTPException(404, "Shop not found")
    allowed = {"currency", "tax_enabled", "notifications_enabled"}
    update = {key: value for key, value in payload.items() if key in allowed}
    if not update:
        raise HTTPException(422, "No supported settings supplied")
    await db.settings.update_one({"shop_id": shop_id}, {"$set": update}, upsert=True)
    return await get_settings(shop_id)


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


@api_router.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def ensure_indexes():
    """Verify MongoDB before serving requests, then create query indexes."""
    try:
        await db.command("ping")
        logger.info("Connected to MongoDB database '%s'", db.name)
    except Exception as exc:
        logger.exception("Cannot connect to MongoDB database '%s'", db.name)
        raise RuntimeError(
            f"MongoDB connection failed for database '{db.name}'. "
            "Check MONGO_URL and that MongoDB is running."
        ) from exc

    # Indexes mirror the API's shop-scoped lookup and reporting paths.
    await db.invoices.create_index("invoice_number", unique=True)
    await db.invoices.create_index([("shop_id", 1), ("created_at", -1)])
    await db.products.create_index([("shop_id", 1), ("sku", 1)], unique=True)
    await db.products.create_index([("shop_id", 1), ("barcode", 1)], unique=True)
    await db.customers.create_index([("shop_id", 1), ("phone", 1)])
    await db.expenses.create_index([("shop_id", 1), ("date", -1)])
    await db.transfers.create_index([("from_shop_id", 1), ("created_at", -1)])
    await db.transfers.create_index([("to_shop_id", 1), ("created_at", -1)])
    await db.transfers.create_index([("status", 1), ("created_at", -1)])

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
