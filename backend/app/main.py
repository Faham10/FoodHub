import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine, ensure_branch_schema
from app import models  # noqa: F401 ensures models are registered before create_all

from app.routers import auth, products, categories, cart, wishlist, addresses, orders, admin, uploads, branches, promotions

app = FastAPI(
    title="Bismillah Food API",
    description="Backend REST API for the Bismillah Food ordering platform",
    version="1.0.0",
)

# Auto-create tables if they don't exist yet (use Alembic migrations in production)
ensure_branch_schema()

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted({
        *(origin.strip().rstrip("/") for origin in settings.FRONTEND_URL.split(",") if origin.strip()),
        "https://food-hub-alpha-five.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "products"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(categories.router)
app.include_router(cart.router)
app.include_router(wishlist.router)
app.include_router(addresses.router)
app.include_router(orders.router)
app.include_router(admin.router)
app.include_router(uploads.router)
app.include_router(branches.router)
app.include_router(branches.admin_router)
app.include_router(promotions.router)
app.include_router(promotions.admin_router)


@app.get("/")
def root():
    return {"message": "Bismillah Food API is running", "docs": "/docs"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
