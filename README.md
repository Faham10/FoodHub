# Bismillah Food — Restaurant Ordering Platform

A complete, full-stack fast-food ordering platform with a customer storefront and an admin dashboard.

- **Frontend:** React 18 + Vite, Tailwind CSS, React Router, Axios, Lucide React
- **Backend:** FastAPI, SQLAlchemy 2.0, Pydantic v2, JWT auth, bcrypt password hashing
- **Database:** PostgreSQL

---

## 1. Features

### Customer
- Browse the menu, search, filter (category / price / availability) and sort (price, newest, popular)
- On opening the storefront, choose Delivery, Pick-Up, or Dine-In and an active branch; products, guest carts, and orders remain branch-specific
- Branches are named Kallu Chock and Korangi 2 throughout the storefront and admin order workflows
- Customer receipts use independent branch order numbers (for example `B1-0001` and `B2-0001`); a customer's history can show orders from both branches
- Product details with related products
- Guest checkout without an account; customer accounts remain optional for saved carts, wishlists, and order history
- Signed-in carts and wishlists are stored in PostgreSQL; guest carts stay in the browser until checkout
- Guest checkout collects customer name, mobile, delivery address or table details, and instructions
- Branch-specific active deals and coupon codes are shown at checkout; coupon codes are checked against branch, dates, limits, minimum order, and applicable products/categories
- Delivery charges, minimum order amounts, free-delivery thresholds, and supported delivery areas are configurable independently for each branch
- Private order-tracking link, order details, and a visual order-tracking timeline
- Signed-in customers can view their cross-branch order history
- Account dashboard: profile, orders, wishlist, addresses

### Admin
- Secure branch-admin login (one shared role-protected `/admin` area filtered by the authenticated admin's branch)
- Dashboard: total orders, pending orders, total revenue, total products, 7-day sales chart, date-filtered daily/weekly/monthly reports, best sellers, recent orders — **all computed live from the database and scoped to the admin's branch**
- Full product CRUD with image upload (JPG/JPEG/PNG/WEBP, 5MB limit), stock, featured/popular/available flags
- Full category CRUD with enable/disable
- Order management: filter branch-owned Delivery, Pick-Up, and Dine-In orders; view full order details and update order/payment status
- Deals & coupons: create, edit, activate/deactivate, schedule, scope to products/categories, and set usage limits for branch-owned promotions
- Delivery settings: configure only the authenticated admin's own branch
- Customer contact details remain available on their orders; there is no separate customer-management screen

### Security
- All prices, discounts, delivery fees and order totals are **calculated server-side** from the database. The frontend never sends — and the backend never trusts — a price, discount or total from the client.
- Coupon usage is row-locked and redeemed within the order transaction; discounts and delivery-area/charge snapshots are stored with each order for stable historical receipts.
- JWT bearer authentication; passwords hashed with bcrypt
- Role-based authorization (`customer` / `branch_admin`) and backend branch ownership checks on protected/admin endpoints
- Every order has a required branch and a unique per-branch receipt number; the database-backed counter increments atomically to prevent duplicate numbers during concurrent checkouts
- Admin order lists, searches, details, updates, dashboard counts, and revenue are isolated by the authenticated admin's branch
- Signed-in customers can only access their own saved orders, cart, wishlist, and addresses; guest order details require the unguessable tracking token
- Order status changes follow a validated state machine (e.g. `Pending → Confirmed → Preparing → Out for Delivery → Delivered`, or cancel at any non-terminal state)

---

## 2. Project Structure

```
foodhub/
├── backend/
│   ├── app/
│   │   ├── models/         # SQLAlchemy models (User, Product, Category, Cart, Wishlist, Address, Order, Promotion...)
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── routers/        # auth, products, categories, cart, wishlist, addresses, orders, promotions, admin, uploads
│   │   ├── services/       # order pricing and concurrency-safe branch order numbering
│   │   ├── dependencies/   # auth dependencies (get_current_user, get_current_active_admin)
│   │   ├── utils/          # security.py — password hashing & JWT
│   │   ├── config.py       # settings loaded from .env
│   │   ├── database.py     # SQLAlchemy engine/session
│   │   ├── seed.py         # optional development data setup (review before use)
│   │   └── main.py         # FastAPI app entrypoint
│   ├── uploads/products/   # uploaded product images are served from here
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/     # Navbar, Footer, ProductCard, OrderTracker, route guards, dialogs...
    │   ├── pages/           # all customer pages
    │   │   └── admin/       # all admin pages
    │   ├── layouts/         # MainLayout, AdminLayout
    │   ├── context/         # AuthContext, CartContext, ToastContext
    │   ├── services/        # axios API client
    │   ├── hooks/, utils/
    │   └── App.jsx, main.jsx, index.css
    ├── index.html
    ├── package.json
    └── .env.example
```

---

## 3. Requirements

- Python 3.10+
- Node.js 18+
- PostgreSQL 13+

---

## 4. PostgreSQL Setup

Create the database and user without placing a password in SQL or source control:

```sql
CREATE DATABASE foodhub_db;
CREATE USER foodhub_user;
GRANT ALL PRIVILEGES ON DATABASE foodhub_db TO foodhub_user;
```

In `psql`, run `\password foodhub_user` and enter a unique password at the prompt. Set `DATABASE_URL` in the private `backend/.env`; URL-encode special characters in the password.

---

## 5. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

if [ ! -f .env ]; then cp .env.example .env; fi
# PowerShell equivalent, also only when no private file exists:
# if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env and set DATABASE_URL, SECRET_KEY, etc. (see below)
```

### Environment Variables (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL URL, e.g. `postgresql://<user>:<url-encoded-password>@<host>:5432/<database>`; keep it private |
| `SECRET_KEY` | Random secret for signing JWTs. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ALGORITHM` | JWT algorithm (default `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes |
| `FRONTEND_URL` | Used for CORS, e.g. `http://localhost:5173` |
| `BRANCH1_ADMIN_EMAIL` / `BRANCH1_ADMIN_PASSWORD` | Unique credentials for the Kallu Chock branch admin |
| `BRANCH2_ADMIN_EMAIL` / `BRANCH2_ADMIN_PASSWORD` | Unique credentials for the Korangi 2 branch admin |

Keep `backend/.env` private; `.env.example` is a template only. Configure two separate branch-admin accounts with different email addresses using the four branch-specific variables above. The seed associates newly created accounts with their corresponding branch, but it does not change existing accounts, passwords, or branch assignments when environment values change. Existing branch admins are preserved; an unassigned admin or an email already used by another account must be reviewed and mapped manually before seeding.

### Optional development seed

Tables are auto-created on app startup. The seed script is only for a new, disposable development database: it adds sample data and can update branch assignments on existing products and orders. It also creates missing branch-admin accounts from the branch-specific environment settings, but does not change existing assigned branch-admin accounts. Do not run it against an existing or production database to configure credentials. For an existing database, start the backend without running the seed script.

```bash
python -m app.seed
```

This creates:
- 12 categories (Burgers, Pizza, Fries, Shawarma, Chicken, Sandwiches, Nuggets, Wings, Rolls, Drinks, Desserts, Deals)
- 34 sample products with realistic PKR pricing
- Two branch-admin accounts using credentials configured privately in `backend/.env` (passwords are bcrypt-hashed)
- Seed execution is idempotent and creates exactly the Kallu Chock and Korangi 2 branches.

### Run the backend

```bash
uvicorn app.main:app --reload --port 8000
```

- API base URL: `http://localhost:8000/api`
- Interactive API docs (Swagger): `http://localhost:8000/docs`

---

## 6. Frontend Setup

```bash
cd frontend
npm install
if [ ! -f .env ]; then cp .env.example .env; fi
# VITE_API_URL=http://localhost:8000/api
npm run dev
```

- App runs at `http://localhost:5173`
- Admin panel: `http://localhost:5173/admin/login`

To build for production:

```bash
npm run build
npm run preview
```

---

## 7. API Reference

Base path: `/api`

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create a customer account, returns JWT |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Current user profile (auth required) |
| PUT | `/auth/me` | Update name/phone (auth required) |

### Products
| Method | Path | Description |
|---|---|---|
| GET | `/products` | List with `search`, `category_id`/`category_slug`, `min_price`, `max_price`, `available_only`, `featured`, `popular`, `sort`, `page`, `page_size` |
| GET | `/products/{id}` | Product details |
| GET | `/products/{id}/related` | Related products (same category) |
| POST | `/products` | Create (admin only) |
| PUT | `/products/{id}` | Update (admin only) |
| DELETE | `/products/{id}` | Delete (admin only) |

### Categories
`GET /categories`, `GET /categories/{id}`, `POST /categories` (admin), `PUT /categories/{id}` (admin), `DELETE /categories/{id}` (admin)

### Cart *(signed-in carts; guest carts are kept in the browser)*
`GET /cart`, `POST /cart/items`, `PUT /cart/items/{id}`, `DELETE /cart/items/{id}`, `DELETE /cart`

### Wishlist *(auth required)*
`GET /wishlist`, `POST /wishlist`, `DELETE /wishlist/{product_id}`

### Addresses *(auth required)*
`GET /addresses`, `POST /addresses`, `PUT /addresses/{id}`, `DELETE /addresses/{id}`

### Orders
- `POST /orders` — places an authenticated or guest order; **product availability, stock, and pricing are validated/recomputed server-side**
- `GET /orders` — the current user's order history
- `GET /orders/{id}` — order detail for its signed-in owner
- `GET /orders/track/{tracking_token}` — securely tracks an order using its private checkout token

### Deals and coupons
- `GET /promotions?branch_id=...` — active deals/coupons for the selected branch
- `GET /admin/promotions`, `POST /admin/promotions`, `PUT /admin/promotions/{id}`, `DELETE /admin/promotions/{id}` — manage the authenticated admin's branch offers; delete archives by deactivating
- A coupon entered at checkout takes precedence over the branch's best automatic deal; the two are not stacked. Percentage discounts are capped at 100%, all discounts are capped at eligible item subtotal, and configured usage limits are enforced in the order transaction.

### Delivery settings
- `GET /branches/{branch_id}/delivery` — public delivery availability, fees, threshold, minimum, and supported areas
- `GET /admin/delivery-settings`, `PUT /admin/delivery-settings` — read or update only the signed-in admin's branch
- An empty delivery-area list means unrestricted area coverage. Once areas are configured, delivery orders must select one of those areas.

### Branch sales reports
- `GET /admin/reports?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&granularity=daily|weekly|monthly` — branch-scoped statistics; the range is limited to 366 days
- Report revenue uses persisted order totals and excludes cancelled orders. Net revenue includes delivery fees and subtracts recorded discounts; gross sales are persisted item subtotals. Average order value is net revenue divided by non-cancelled placed orders. Status counts include cancelled orders separately.
- Best-selling products use persisted order-item names, quantities, and line totals. Category popularity is not reported because historical order items do not snapshot category names.

### Admin *(admin auth required)*
- `GET /admin/dashboard` — live stats, recent orders, best sellers, 7-day sales
- `GET /admin/orders?order_type=Delivery|Pick-Up|Dine-In`, `GET /admin/orders/{id}`, `PUT /admin/orders/{id}` (branch-scoped order management)
- `GET /admin/products`

### Uploads
`POST /uploads/products` (admin, multipart form file upload) → `{ "url": "/uploads/products/xxxx.jpg" }`

---

## 8. How to Run Locally (Quick Start)

```bash
# Terminal 1 — backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
if [ ! -f .env ]; then cp .env.example .env; fi   # edit DATABASE_URL to match your PostgreSQL setup
# PowerShell equivalent, only when no private file exists:
# if (-not (Test-Path .env)) { Copy-Item .env.example .env }
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
if [ ! -f .env ]; then cp .env.example .env; fi
# PowerShell equivalent, only when no private file exists:
# if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Visit `http://localhost:5173` for the store and `http://localhost:5173/admin/login` for the admin panel. Use the private branch-admin credentials configured in `backend/.env`.
The quick start deliberately does not seed the database. Configure distinct branch-admin credentials in the private environment file only when setting up a new development database; changing environment values does not update existing accounts.

---

## 9. Storefront and Admin

- Customers can browse the database-backed menu and check out as guests without creating an account or signing in.
- The initial order setup lets customers select Delivery, Pick-Up, or Dine-In and choose a branch.
- Guest checkout collects customer/contact and delivery or table details; the backend calculates prices and validates stock.
- Guest order confirmation shows a printable receipt and live order-status timeline; a current-order status control stays in the top navigation beside the cart while browsing.
- Guest tracking uses a private token saved in that browser, so customers can reopen their latest order status without an account.
- Guest order history lists orders placed in the same browser, including orders from both branches, with their own receipt links and live branch-specific status.
- Admin sign-in remains available at `/admin/login`; customer login and signup pages are not part of the storefront.
- Branch admins see branch-scoped orders and statistics, with order lists filterable by Delivery, Pick-Up, and Dine-In.
- Product & category CRUD, image upload, and enable/disable remain available in the admin panel.

---

## 10. Notes

- Uploaded product images are stored on disk under `backend/uploads/products/` and served at `/uploads/products/<file>`.
- Database tables are created automatically on backend startup (`Base.metadata.create_all`). New branch-delivery and order-snapshot columns are added with the existing additive startup schema migration; promotion tables are created if absent. The previous 100 PKR discount for 2,000 PKR orders is migrated idempotently into one automatic deal per active branch. No existing rows are dropped or reset. For a production deployment, use a versioned migration system such as Alembic.
- Existing branches retain the previous defaults (150 PKR delivery charge and free delivery at 3,000 PKR). Admins can change these independently. Blank delivery-area settings preserve unrestricted existing coverage until a branch configures a list.
- Only Cash on Delivery is enabled today; the `payment_method` field and order schema are already shaped to add an online gateway later.
