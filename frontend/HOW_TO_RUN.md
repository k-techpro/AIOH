# How to Run RetailPrime and See Your Changes

## Quick Start Guide

### Step 1: Install Dependencies (if needed)

```bash
cd C:\AIOH\AIOH\frontend
npm install
```

### Step 2: Start the Expo Development Server

```bash
npm start
```

This will output something like:

```
Starting Expo...
 ▄▀▀▀▄ ▄▀▀▀▄ ▄▀▀▀▄
█       █       █
█  ▄▀▀▀▄█  ▄▀▀▀▄█  ▄▀▀▀▄
█ █     █ █     █ █     █
 ▀ ▄▀▀▀▄ ▀ ▄▀▀▀▄ ▀ ▄▀▀▀▄
   
Started Metro Bundler
QR code:
████████████████████
...
```

### Step 3: Choose How to Run

**Option A: Android Emulator**
```
Press 'a' in the terminal to run on Android emulator
```

**Option B: Physical Android Device**
1. Install Expo Go app from Google Play Store
2. Scan the QR code displayed in terminal
3. App will open on your device

**Option C: iOS (Mac only)**
```
Press 'i' in the terminal to run on iOS simulator
```

**Option D: Web Browser**
```
Press 'w' in the terminal to run in web browser
```

---

## What to Test - Phase 1: Coupon System

### Test 1: Bill Without Coupon (Most Important!)

1. **Open the app** → Select your shop
2. **Go to Dashboard** → Click "New Sale" (or "New Sale" card)
3. **Add Products to Cart**
   - Search for a product (e.g., "iPhone", "Samsung")
   - Click the product to add to cart
   - Adjust quantity using + / - buttons
4. **Click "View Cart"** (floating button at bottom)
5. **In Cart Review Screen:**
   - See your products listed
   - See subtotal, GST, and total
   - **Leave Coupon Code EMPTY**
   - Click "Generate Invoice" button
6. **EXPECTED RESULT:**
   ✅ Invoice generates successfully
   ✅ Success screen shows with invoice number
   ✅ No error about missing coupon
   ✅ Bill amount is correct (subtotal)

---

### Test 2: Bill With Valid Fixed Coupon

**First: Create a Coupon**
1. Go to **Dashboard** → **Settings** (scroll down)
2. Click **Settings** → Find **Coupons**
3. Click **Add Coupon** (+ button)
4. Fill in:
   - **Code:** `SAVE100`
   - **Discount Type:** Fixed (₹)
   - **Discount:** `100`
   - **Enabled:** ON
   - Click **Save Coupon**

**Then: Use the Coupon**
1. Go to **New Sale**
2. Add products totaling ₹1000+
3. Click **View Cart**
4. In coupon section:
   - Type: `SAVE100`
   - Click **Apply** button
5. **EXPECTED RESULT:**
   ✅ Green card appears showing "SAVE100"
   ✅ Discount shows ₹100
   ✅ Total reduces by ₹100
   ✅ Can click "Remove" to clear coupon
   ✅ "Generate Invoice" button works

---

### Test 3: Bill With Percentage Coupon

**Create Coupon:**
1. **Settings** → **Coupons** → **Add Coupon**
2. Fill in:
   - **Code:** `SAVE10`
   - **Discount Type:** Percentage (%)
   - **Discount:** `10`
   - **Max Discount:** `500` (optional)
   - **Enabled:** ON
   - Click **Save Coupon**

**Use Coupon:**
1. **New Sale** → Add products (₹1000 subtotal)
2. **View Cart**
3. Enter coupon: `SAVE10`
4. Click **Apply**
5. **EXPECTED RESULT:**
   ✅ Discount shows ₹100 (10% of 1000)
   ✅ Total shows ₹900
   ✅ If you had ₹10,000 subtotal with max discount ₹500:
      - Discount would cap at ₹500 (not ₹1000)

---

### Test 4: Invalid Coupon Error → Skip

1. **New Sale** → Add products
2. **View Cart**
3. Enter coupon: `INVALID_CODE_12345`
4. Click **Apply**
5. **EXPECTED RESULT:**
   ✅ Error message: "Invalid coupon"
   ✅ Red error box appears with "Skip Coupon →" link
   ✅ Click "Skip Coupon" → Error clears
   ✅ Can now click "Generate Invoice" without coupon
   ✅ Bill completes at full price

---

### Test 5: Expired Coupon

**Create Expired Coupon:**
1. **Settings** → **Coupons** → **Add Coupon**
2. Fill in:
   - **Code:** `EXPIRED20`
   - **Discount Type:** Fixed (₹)
   - **Discount:** `20`
   - **Advanced Options:** ON
   - **Start Date:** `2026-08-01`
   - **End Date:** `2026-08-31` (past date)
   - Click **Save Coupon**

**Try to Use:**
1. **New Sale** → Add products
2. **View Cart**
3. Enter: `EXPIRED20`
4. Click **Apply**
5. **EXPECTED RESULT:**
   ✅ Error: "Coupon is expired"
   ✅ Can click "Skip Coupon"
   ✅ Bill completes without discount

---

### Test 6: Remove Applied Coupon

1. Create and apply a valid coupon (e.g., `SAVE100`)
2. See the **green card** showing the coupon
3. Click the **"Remove"** button on the right
4. **EXPECTED RESULT:**
   ✅ Green card disappears
   ✅ Discount resets to ₹0
   ✅ Total returns to original subtotal
   ✅ Can now complete bill at original price

---

## What to Test - Phase 2: Home Screen Design

### View the New Home Screen

1. Open app → Select shop
2. **Go to Dashboard** (default screen)
3. **Scroll through the page**

### What You'll See (Top to Bottom):

**1. Premium Header**
- Brand gradient background
- "RetailPrime" title
- Shop name (clickable to switch)
- Notifications bell

**2. Primary Actions (Horizontal Scroll)**
- Blue cards with icons
- Scroll left/right to see: New Sale, Inventory, Customers, Invoices
- Click any to navigate

**3. Today's Overview Card**
- Large sales amount in blue
- Below: Sales count | Customers | Low Stock

**4. Business Snapshot (3 Cards)**
- Pending Payments (orange/warning icon)
- Low Stock (blue/info icon)
- Out of Stock (red/error icon)

**5. Quick Actions (4 Cards)**
- New Customer, New Product, New Invoice, Add Expense
- 2x2 grid layout

**6. All Services (9 Cards)**
- 3-column grid
- Sales, Inventory, Finance, Reports, Staff, Attendance, Services, Alerts, Settings

**7. Floating Action Button (FAB)**
- Round button bottom-right
- Blue gradient
- Click to create new sale

---

## Firestore Verification

### Check if Data is Persisted

1. **Open Firebase Console:**
   - Go to: https://console.firebase.google.com/
   - Select your RetailPrime project
   - Click **Firestore Database**

2. **Navigate to:**
   ```
   users → {your-uid} → businessData → coupons → records
   ```

3. **You should see:**
   - Your created coupons (SAVE100, SAVE10, etc.)
   - Fields: code, discount, discountType, enabled, startDate, endDate, usageLimit
   - Data persists after app restart ✅

4. **Check Invoices:**
   ```
   users → {your-uid} → businessData → invoices → records
   ```
   - Should see created invoices
   - Fields include: couponCode, discount, total, etc.

---

## Cloud Storage Verification

### Check Invoice PDFs

1. **Firebase Console**
2. Click **Storage**
3. Navigate:
   ```
   invoices/
     {your-uid}/
       2026/
         09/
           INV-2026-XXXXX.pdf
   ```

4. **You should see:**
   - PDF files for each generated invoice
   - Named with invoice numbers
   - Upload timestamps

---

## Troubleshooting

### App Won't Start

```bash
# Clear cache and reinstall
npm install --legacy-peer-deps
npm start
```

### TypeScript Errors

```bash
# Verify compilation is clean
npx tsc --noEmit
```
Should show: *no output = success*

### Firestore Connection Issues

1. Check **google-services.json** exists in project root
2. Verify Firebase project ID matches app.json
3. Check authentication status in app

### Can't See Changes After Code Update

1. **Full rebuild:**
   ```bash
   npm start
   ```
   - Press 'r' to reload
   - Or 'R' for full restart

2. **Clear Metro cache:**
   ```bash
   npm start -- --reset-cache
   ```

---

## Running on Android Device (Recommended for Testing)

### Prerequisites:
- Android phone with Expo Go app installed
- Both phone and computer on same WiFi network

### Steps:

1. **Start server:**
   ```bash
   npm start
   ```

2. **In terminal, press 'a'** to open Android menu

3. **Scan QR code** with your phone (Camera app or Expo Go)

4. **App opens** on your device in a few seconds

5. **Test coupon flow** on real phone:
   - Much more realistic
   - Touch interactions feel natural
   - See actual mobile layout

---

## Quick Test Checklist

- [ ] App starts without errors
- [ ] Can select shop
- [ ] Dashboard shows new Paytm-style home screen
- [ ] Can create coupon with fixed discount
- [ ] Can create coupon with percentage discount
- [ ] Can apply valid coupon to bill
- [ ] Can see discount calculated correctly
- [ ] Can remove applied coupon
- [ ] Can bill WITHOUT coupon (most important!)
- [ ] Invalid coupon shows error
- [ ] Can skip invalid coupon
- [ ] Invoice generates successfully
- [ ] Coupon data in Firestore ✅
- [ ] Invoice PDF in Cloud Storage ✅
- [ ] App restart → data still there ✅

---

## Next Steps

Once you verify everything works:

1. **Deploy to Firebase:**
   ```bash
   firebase deploy
   ```

2. **Build APK for Android:**
   ```bash
   eas build --platform android
   ```

3. **Build IPA for iOS:**
   ```bash
   eas build --platform ios
   ```

---

## Need Help?

If you encounter issues:

1. Check the terminal output for error messages
2. Open DevTools: Press Ctrl+M (Android) or Cmd+D (iOS)
3. Check Firestore console for data
4. Verify TypeScript: `npx tsc --noEmit`

**Everything is ready to run!** 🚀
