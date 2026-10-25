# RetailPrime — Mobile Shop ERP

**Type:** Premium Mobile Business Management System for Indian mobile phone & accessories retail

## Product

A production-quality multi-shop POS + Billing + Inventory + Customer + Stock Transfer + Finance + GST + Reports application built as a mobile-first Expo app. Designed for a non-technical Indian shop owner — Indian currency (₹), Indian number formatting (₹L / ₹Cr), realistic seeded data.

## Tech Stack

- **Frontend:** Expo 54 + Expo Router + React Native + zustand + react-native-gifted-charts + Ionicons
- **Backend:** FastAPI + Motor (MongoDB async)
- **Design:** Premium "Obsidian & Sand" palette, Inter typography, 8pt grid, light + dark mode, tier-1 shadows, no glassmorphism

## Core Features Delivered

- **Shop Selection** with per-shop KPIs and 7-day sales sparkline; "View Overall Business" consolidated mode
- **Executive Dashboard**: Good-morning hero, horizontal "Needs Attention" alerts, 2×2 KPI grid (Sales / Profit / Outstanding / Monthly), 30/7 day sales trend area chart, Top Products, Sales by Category donut, Stock Attention, Recent Sales timeline
- **POS Terminal**: search products, walk-in / existing customer picker, cart bottom-sheet with GST split, 4 payment methods, invoice generation with success takeover
- **Inventory**: KPI strip (value / profit / low / out), category chips (horizontal, non-wrapping), status badges, product detail bottom-sheet
- **Customers**: filter (All / Due / GST), search, initials avatar, dues badge, detail profile with LTV / AOV / purchase history
- **Invoice History** with status filter and balance-due callout
- **Stock Transfer** between shops with full new-transfer bottom-sheet
- **Expenses** with category chips, monthly / top-category stats
- **Reports Center** (14-day revenue bar chart, GST summary)
- **Barcode Generator** with visual barcode preview
- **Finance / GST / Shops / Services / Staff / Settings / Notifications** screens
- **Dark mode** support (system-controlled, respected everywhere via useTheme)

## Backend API (all under /api)

- shops, dashboard/{shop_id or "all"}, products (list/get/create/filter), customers (list/get/create/search), invoices (list/get/create with auto-decrement stock & customer update), expenses, transfers, reports/gst/{shop_id}, seed

## Data

Seeded with realistic Indian data: 2 shops (Poonamallee, Kundrathur), 72 products (Samsung, Redmi, OnePlus, Apple, Vivo, Oppo, Realme phones + accessories), 150 Indian customers, ~800 invoices spanning last 90 days, 35 expenses, 54 stock transfers.

## Testing

- Backend: 26/26 pytest cases passed. Invoice creation confirmed to decrement stock and update customer totals. No `_id` leaks in any response.
- Frontend: verified via Playwright — shop selection, dashboard, POS, inventory, customers, more menu all render cleanly.

## Known limitations / next builds

- Returns/refunds, live stock/payment notifications, services, and staff attendance are implemented. Granular staff permissions remain an extension point.
- Real barcode scanning uses camera plugin (not wired in preview)
- Sales/Product/Stock deep reports show KPI + summary; drill-downs to add on next iteration
