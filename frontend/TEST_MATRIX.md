# RetailPrime Mobile ERP - Manual Test Execution Guide

## PRE-TEST CHECKLIST
- [ ] Device is connected via ADB (run: `adb devices`)
- [ ] App is installed: `npm run android` completed successfully
- [ ] Firebase is initialized and Firestore is accessible
- [ ] Have at least one shop selected
- [ ] Backend server is running (if applicable)

---

## TEST GROUP 1: CRITICAL INVOICE GENERATION (HIGHEST PRIORITY)

### Test 1.1: Invoice with Walk-in Customer (NO customer_phone undefined error)
**Objective**: Verify the sanitizeForFirestore fix prevents "Unsupported field value: undefined" error

**Steps**:
1. Open app and navigate to POS (New Sale)
2. Add at least 2 products to cart
3. DO NOT select a customer (leave as Walk-in)
4. Tap "Checkout" → "Continue to Payment"
5. Select payment method: "Cash"
6. Enter amount received equal to or greater than total
7. Tap "Generate Invoice"

**Expected Result**:
- ✅ Invoice generates without error
- ✅ Success screen appears with invoice number and total
- ✅ In Firestore `invoices` collection, verify:
  - `customer_phone` field is `null` (NOT undefined)
  - `coupon_code` field is `null` (NOT undefined)
  - NO undefined values in any field
- ✅ Invoice PDF created locally
- ✅ Customer data unchanged (walk-in not registered)

**Failure Criteria**:
- ❌ Error message: "Unsupported field value: undefined"
- ❌ Error message: "The bill was not completed..."
- ❌ No invoice generated
- ❌ Firestore shows undefined values

---

### Test 1.2: Invoice with Registered Customer
**Objective**: Verify invoice generation works with existing customer

**Steps**:
1. From cart screen, tap "Select Customer"
2. Choose an existing customer from list
3. Add 2-3 products
4. Proceed to checkout and payment
5. Generate invoice with "Cash" payment

**Expected Result**:
- ✅ Invoice generates successfully
- ✅ Customer phone is correctly populated (not undefined)
- ✅ Customer's total_purchases, total_paid, total_due updated
- ✅ In Firestore `customers` collection, verify:
  - Customer record has updated totals
  - NO undefined values

---

### Test 1.3: Invoice with Coupon (Coupon Code NOT Undefined)
**Objective**: Verify coupon is properly saved without undefined error

**Steps**:
1. Add products to cart
2. In checkout, enter a valid coupon code (e.g., "SUMMER20")
3. Verify coupon discount applies
4. Complete invoice generation

**Expected Result**:
- ✅ Coupon applies correctly
- ✅ Invoice generates without error
- ✅ In Firestore `invoices` collection:
  - `coupon_code` field contains actual coupon code (not undefined)
  - `discount` field contains correct amount
  - `total` reflects discount applied

---

### Test 1.4: Invoice WITHOUT Coupon (Coupon Code = Null)
**Objective**: Verify coupon field properly sets to null when not used

**Steps**:
1. Add products to cart
2. Skip coupon entry
3. Complete invoice generation

**Expected Result**:
- ✅ Invoice generates
- ✅ In Firestore `invoices`:
  - `coupon_code` is `null` (not undefined, not empty string)
  - `discount` is 0
  - Total reflects no discount

---

### Test 1.5: Atomic Transaction Verification
**Objective**: Verify all Firestore collections updated atomically

**Steps**:
1. Note product stock BEFORE invoice
2. Generate invoice with 5 items
3. Immediately check Firestore collections

**Expected Result**:
- ✅ In `invoices`: Document exists with all fields populated
- ✅ In `payments`: Payment record exists with matching total
- ✅ In `sales`: Sales record exists with matching invoice_id
- ✅ In `inventoryMovements`: Movement records created for each item
- ✅ In `products`: Stock decremented by exact quantities sold
- ✅ NO partial updates (all succeed or all fail)
- ✅ NO undefined values in ANY collection

**Failure Criteria**:
- ❌ Invoice exists but payment not created
- ❌ Payment exists but inventory not updated
- ❌ Any undefined fields in any collection
- ❌ Stock numbers don't match

---

### Test 1.6: Invoice PDF Generation
**Objective**: Verify PDF created locally and uploaded to storage

**Steps**:
1. Generate invoice with all details
2. Check success screen for PDF icon
3. Tap to view PDF

**Expected Result**:
- ✅ PDF displays correctly
- ✅ Contains invoice number, items, totals, customer info
- ✅ No corrupted content

---

### Test 1.7: Large Cart (Edge Case)
**Objective**: Verify invoice generation with 20+ items

**Steps**:
1. Add same product 20+ times to cart
2. Generate invoice with all items

**Expected Result**:
- ✅ Invoice generates without timeout
- ✅ All items in PDF
- ✅ Totals calculated correctly
- ✅ Firestore contains all items
- ✅ No undefined values

---

## TEST GROUP 2: HOME SCREEN REDESIGN

### Test 2.1: Dashboard Layout
**Objective**: Verify new home screen layout matches requirements

**Steps**:
1. Navigate to home screen (tap tab or restart app)
2. Observe layout structure

**Expected Result**:
- ✅ Header with gradient (greeting, shop name, search/notifications buttons)
- ✅ Top 4 rectangular widgets: New Sale, Customers, Invoice, Services
- ✅ Section headings with UPPERCASE text
- ✅ Circular widgets in 4 columns below rectangles
- ✅ Sales Performance chart with 7-day line graph
- ✅ TODAY'S OVERVIEW section (Total Sales, Orders, Customers, Pending)
- ✅ BUSINESS SNAPSHOT with 4 cards (Products, Low Stock, Out of Stock, Services)
- ✅ Floating Action Button (FAB) in bottom-right
- ✅ No ugly white nested backgrounds
- ✅ Glass card styling with proper shadows

---

### Test 2.2: Top Widgets Functionality
**Objective**: Verify top 4 rectangular widgets navigate correctly

**Steps**:
1. Tap "New Sale" → Should go to POS
2. Tap "Customers" → Should go to Customers list
3. Tap "Invoice" → Should go to Invoice History
4. Tap "Services" → Should go to Services

**Expected Result**:
- ✅ All 4 widgets navigate to correct screens

---

### Test 2.3: Circular Widgets Organization
**Objective**: Verify circular widgets grouped by section

**Steps**:
1. Scroll down dashboard
2. Observe section headings and circular widget arrangement

**Expected Result**:
- ✅ QUICK SALES section (4 circular widgets)
- ✅ CUSTOMER & BILLING section (2 circular widgets)
- ✅ INVENTORY section (2 circular widgets)
- ✅ BUSINESS section (2 circular widgets)
- ✅ OPERATIONS section (2 circular widgets)
- ✅ CONFIGURATION section (2 circular widgets)
- ✅ Each section properly titled in UPPERCASE
- ✅ Widgets arranged 4-per-row (responsive)

---

### Test 2.4: Sales Chart
**Objective**: Verify 7-day sales chart displays

**Steps**:
1. Look at SALES PERFORMANCE section
2. Observe line chart with data points

**Expected Result**:
- ✅ Chart shows 7 days (today and 6 days prior)
- ✅ Y-axis shows sales amounts
- ✅ X-axis shows date numbers
- ✅ Line connects data points
- ✅ Shaded area under line

---

### Test 2.5: Today's Overview
**Objective**: Verify today's metrics display correctly

**Steps**:
1. Look at TODAY'S OVERVIEW section
2. Verify numbers match today's activity

**Expected Result**:
- ✅ Total Sales shows sum of today's invoices
- ✅ Orders shows count of today's invoices
- ✅ Customers shows total registered customers
- ✅ Pending shows invoices with balance_due > 0

---

### Test 2.6: Business Snapshot
**Objective**: Verify business metrics cards

**Steps**:
1. Look at BUSINESS SNAPSHOT section
2. Verify all 4 cards visible

**Expected Result**:
- ✅ Products card shows total products
- ✅ Low Stock card shows items with stock ≤ min_stock
- ✅ Out of Stock card shows items with stock = 0
- ✅ Active Services card shows total services

---

### Test 2.7: Floating Action Button
**Objective**: Verify FAB launches new sale

**Steps**:
1. Tap circular FAB in bottom-right
2. Should navigate to POS

**Expected Result**:
- ✅ FAB tappable
- ✅ Navigates to POS screen

---

## TEST GROUP 3: SEARCH FUNCTIONALITY

### Test 3.1: Search Screen Opens
**Objective**: Verify search button navigates correctly

**Steps**:
1. From dashboard, tap search icon (magnifying glass)
2. Should open search screen

**Expected Result**:
- ✅ Search screen opens
- ✅ Search input auto-focused
- ✅ Filter tabs visible (All, Invoices, Services)

---

### Test 3.2: Search by Invoice Number
**Objective**: Verify invoice search works

**Steps**:
1. Type invoice number (e.g., "INV-2026-12345")
2. Verify results

**Expected Result**:
- ✅ Matching invoice appears in results
- ✅ Shows invoice number, customer, amount, date
- ✅ Results sorted by date (newest first)

---

### Test 3.3: Search by Customer Name
**Objective**: Verify customer name search

**Steps**:
1. Type customer name (e.g., "John")
2. Verify results

**Expected Result**:
- ✅ All invoices from customers with that name appear
- ✅ Results show customer name and phone

---

### Test 3.4: Filter Tabs
**Objective**: Verify filter tabs work correctly

**Steps**:
1. Search for "invoice"
2. Tap "Invoices" tab → Should show only invoices
3. Tap "Services" tab → Should show only services
4. Tap "All" tab → Should show both

**Expected Result**:
- ✅ Filters work correctly
- ✅ Tab selection visually indicates active filter

---

### Test 3.5: Click Invoice Result
**Objective**: Verify clicking search result opens invoice

**Steps**:
1. Search for an invoice
2. Tap on result

**Expected Result**:
- ✅ Invoice details screen opens (or PDF viewer)

---

## TEST GROUP 4: SETTINGS & NAVIGATION

### Test 4.1: Settings Button Opens
**Objective**: Verify Settings navigation works

**Steps**:
1. Find Settings button/link
2. Tap to open Settings screen

**Expected Result**:
- ✅ Settings screen opens
- ✅ Shows page title "Settings" and subtitle "Business workspace"

---

### Test 4.2: Coupon Management Link
**Objective**: Verify coupon management accessible from Settings

**Steps**:
1. In Settings screen, look for "Coupon Management"
2. Tap link

**Expected Result**:
- ✅ Coupon Management screen opens
- ✅ Can create and view coupons

---

### Test 4.3: Settings Information
**Objective**: Verify Settings displays account and app info

**Steps**:
1. In Settings screen, look for sections

**Expected Result**:
- ✅ Account Settings section visible
- ✅ About RetailPrime section shows version (1.0.1)

---

## TEST GROUP 5: COUPONS (ENSURE NO REGRESSION)

### Test 5.1: Create Coupon
**Objective**: Verify coupon creation works

**Steps**:
1. Navigate to Coupon Management
2. Create new coupon with:
   - Code: "TEST20"
   - Discount: 20
   - Discount Type: percentage
3. Save

**Expected Result**:
- ✅ Coupon saved without error
- ✅ Appears in coupon list
- ✅ In Firestore `coupons`, verify:
  - code = "TEST20"
  - discount = 20
  - discountType = "percentage"
  - NO undefined values

---

### Test 5.2: Apply Coupon to Invoice
**Objective**: Verify coupon applies and saves correctly

**Steps**:
1. Generate invoice
2. Before payment, enter coupon code "TEST20"
3. Verify discount applied
4. Complete invoice

**Expected Result**:
- ✅ Discount shows in cart (20% of subtotal)
- ✅ Total reduces correctly
- ✅ Invoice saves with coupon_code = "TEST20"
- ✅ discount field shows exact amount

---

### Test 5.3: Invalid Coupon Rejected
**Objective**: Verify invalid coupon shows error

**Steps**:
1. In checkout, enter "INVALID123"
2. Attempt to apply

**Expected Result**:
- ✅ Error message appears: "Invalid coupon"
- ✅ Discount not applied
- ✅ Invoice generates without coupon if user proceeds

---

## TEST GROUP 6: SERVICES & DATE PICKER

### Test 6.1: Services Screen Opens
**Objective**: Verify Services accessible

**Steps**:
1. Navigate to Services (from dashboard or main menu)

**Expected Result**:
- ✅ Services screen opens
- ✅ Shows list of existing services (if any)
- ✅ "Add Service" button visible

---

### Test 6.2: Date Picker Works
**Objective**: Verify date picker for Expected Delivery

**Steps**:
1. Tap "Add Service" or edit existing
2. Tap on "Expected Delivery Date" field
3. Select a future date

**Expected Result**:
- ✅ Date picker opens
- ✅ User can select date
- ✅ Selected date displays in field (YYYY-MM-DD format)

---

### Test 6.3: Service Status Toggle
**Objective**: Verify status changes work

**Steps**:
1. Create/edit service
2. Toggle between "IN_SERVICE" and "READY"
3. Save

**Expected Result**:
- ✅ Status toggles visually
- ✅ Service saves with selected status
- ✅ In Firestore `services`:
  - status = "IN_SERVICE" or "READY"
  - NO "Unsupported field value" errors

---

### Test 6.4: Service Created in Firestore
**Objective**: Verify service data saves correctly

**Steps**:
1. Create service with all fields
2. Check Firestore `services` collection

**Expected Result**:
- ✅ Service document created
- ✅ All fields present (customerName, serviceName, price, expectedDelivery, status, etc.)
- ✅ NO undefined values
- ✅ NO Unsupported field errors in console

---

## TEST GROUP 7: ANDROID BUILD & INSTALL

### Test 7.1: Build Completes Successfully
**Objective**: Verify Android build succeeds

**Steps**:
1. Run `npm run android`
2. Wait for build to complete

**Expected Result**:
- ✅ BUILD SUCCESSFUL in console output
- ✅ No compilation errors
- ✅ Only warnings (if any)

---

### Test 7.2: APK Installs Correctly
**Objective**: Verify APK installs without conflicts

**Steps**:
1. After build completes, observe installation

**Expected Result**:
- ✅ APK installs successfully
- ✅ No "old app" conflict errors
- ✅ Installation prompt shows "RetailPrime" (current app)

---

### Test 7.3: App Launches to Home Screen
**Objective**: Verify app launches correctly

**Steps**:
1. After install, app should auto-launch
2. Observe which screen appears

**Expected Result**:
- ✅ App launches to home screen (or shop selector if first time)
- ✅ NOT to old/different app version
- ✅ Correct package/app ID (com.emergent.retailprime)

---

## TEST GROUP 8: FIRESTORE DATA INTEGRITY

### Test 8.1: No Undefined in Invoices
**Objective**: Audit invoices collection

**Steps**:
1. In Firestore Console, open `users/{uid}/businessData/invoices/records`
2. Sample 5+ invoices
3. Check each field for undefined values

**Expected Result**:
- ✅ All fields are either:
  - Populated with valid values
  - `null` (for optional fields)
  - NOT undefined
- ✅ Numeric fields are valid numbers (not NaN, Infinity)
- ✅ Date fields are ISO strings (not Date objects)

---

### Test 8.2: No Undefined in Payments
**Objective**: Audit payments collection

**Steps**:
1. Open `payments/records` collection
2. Verify 5+ payment records

**Expected Result**:
- ✅ All payments have valid data
- ✅ No undefined values
- ✅ All required fields present

---

### Test 8.3: No Undefined in Sales
**Objective**: Audit sales collection

**Steps**:
1. Open `sales/records` collection
2. Check records

**Expected Result**:
- ✅ All sales records have valid data
- ✅ No undefined values
- ✅ Matches invoice totals

---

### Test 8.4: No Undefined in Inventory Movements
**Objective**: Audit inventory movements

**Steps**:
1. Open `inventoryMovements/records` collection
2. Check recent movements (from invoices created today)

**Expected Result**:
- ✅ All movements have valid data
- ✅ quantityDelta, previousQuantity, newQuantity are valid numbers
- ✅ No undefined values

---

### Test 8.5: No Undefined in Services
**Objective**: Audit services collection

**Steps**:
1. Open `services/records` collection
2. Check service records

**Expected Result**:
- ✅ customerName, serviceName, price, expectedDelivery all populated
- ✅ NO "Unsupported field value: undefined" in Firestore logs
- ✅ status field = "IN_SERVICE" or "READY"

---

### Test 8.6: Transactions are Atomic
**Objective**: Verify all-or-nothing transaction behavior

**Steps**:
1. Create invoice with valid products
2. Before transaction completes, simulate network failure
3. Check Firestore for partial updates

**Expected Result**:
- ✅ Either ALL collections updated or NONE
- ✅ No partial invoice (where payment exists but inventory not updated)
- ✅ Transactions not left in intermediate state

---

## TEST GROUP 9: EDGE CASES

### Test 9.1: Very Large Cart
**Objective**: Verify system handles 20+ items

**Steps**:
1. Add same product 20+ times
2. Generate invoice

**Expected Result**:
- ✅ Invoice processes without timeout
- ✅ All items saved in Firestore
- ✅ Correct totals

---

### Test 9.2: Decimal Prices
**Objective**: Verify decimal handling

**Steps**:
1. Create product with price 99.99
2. Add to cart with qty 3
3. Verify calculations

**Expected Result**:
- ✅ Price displays as 99.99 (not 99.99000000001)
- ✅ Totals calculated correctly
- ✅ No rounding errors

---

### Test 9.3: GST Calculations
**Objective**: Verify GST calculations correct

**Steps**:
1. Create invoice with products having different GST rates
2. Verify GST total matches manual calculation

**Expected Result**:
- ✅ GST calculated per-item correctly
- ✅ Total GST matches sum of item GSTs
- ✅ Final total = subtotal + GST - discount

---

### Test 9.4: Balance Due Calculation
**Objective**: Verify balance due handled correctly

**Steps**:
1. Generate invoice for ₹1000
2. Pay ₹600 (partial payment)
3. Verify balance_due = 400

**Expected Result**:
- ✅ balance_due = total - amount_paid
- ✅ Status = "partial" for partial payments
- ✅ status = "paid" for full payment
- ✅ status = "due" if amount_paid = 0

---

### Test 9.5: Pay Later Payment Method
**Objective**: Verify Pay Later works

**Steps**:
1. Create invoice
2. Select "Pay Later" payment method
3. Enter 0 amount received
4. Generate invoice

**Expected Result**:
- ✅ Invoice saves with payment_method = "pay_later"
- ✅ status = "due"
- ✅ balance_due = total

---

## TEST GROUP 10: DATA PERSISTENCE

### Test 10.1: Invoice Persists After Restart
**Objective**: Verify data survives app restart

**Steps**:
1. Generate invoice
2. Note invoice number and customer
3. Force close app (long press → close)
4. Reopen app
5. Navigate to Invoice History

**Expected Result**:
- ✅ Invoice appears in list
- ✅ All details intact (customer, amount, date)

---

### Test 10.2: Customer Data Persists
**Objective**: Verify customer updates persist

**Steps**:
1. Create invoice with registered customer
2. Check customer total_purchases increased
3. Restart app
4. Check customer data

**Expected Result**:
- ✅ Customer total_purchases reflects invoice
- ✅ Data from Firestore, not mock data

---

### Test 10.3: Products Persist
**Objective**: Verify product inventory persists

**Steps**:
1. Note product stock
2. Generate invoice with product (qty 5)
3. Check stock decreased by 5
4. Restart app

**Expected Result**:
- ✅ Stock remains decreased
- ✅ Data from Firestore (real-time)

---

### Test 10.4: No Mock Data for Production
**Objective**: Verify app uses Firestore only

**Steps**:
1. Look for any mock-data.ts imports in production code paths
2. Verify all data reads from useMockStore come from Firebase subscriptions

**Expected Result**:
- ✅ useMockStore only reads from Firestore
- ✅ No hardcoded mock products in invoices
- ✅ All customers are from customers collection

---

## SUMMARY TEST EXECUTION

### Critical Path (Must Pass)
- [ ] Test 1.1: Invoice with walk-in customer (NO undefined error)
- [ ] Test 1.2: Invoice with registered customer
- [ ] Test 1.3: Invoice with coupon
- [ ] Test 1.4: Invoice without coupon (null handling)
- [ ] Test 1.5: Atomic transaction verification
- [ ] Test 8.1-8.5: No undefined values in Firestore
- [ ] Test 7.1-7.3: Android build and launch

### High Priority
- [ ] Test 2.1-2.7: Home screen redesign
- [ ] Test 3.1-3.5: Search functionality
- [ ] Test 4.1-4.3: Settings navigation

### Medium Priority
- [ ] Test 5.1-5.3: Coupons (no regression)
- [ ] Test 6.1-6.4: Services and date picker

### Low Priority (Edge Cases & Verification)
- [ ] Test 9.1-9.5: Edge cases
- [ ] Test 10.1-10.4: Data persistence

---

## ISSUE REPORTING

If any test fails, document:
1. Test ID and name
2. Device info (Android version, model)
3. Steps to reproduce
4. Expected vs actual result
5. Error message (if any)
6. Firestore data showing issue
7. Console logs (if available)

