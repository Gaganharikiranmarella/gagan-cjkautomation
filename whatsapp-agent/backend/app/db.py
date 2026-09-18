"""Database access.

Uses a small psycopg3 connection pool (serverless-friendly: min_size=0, so a
cold Vercel function doesn't pay for idle connections) and sets the two RLS
session variables — app.tenant_id / app.role — on every connection handed out
to a request, per database/schema.sql's tenant_isolation policies.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator, Optional

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings

_pool: Optional[ConnectionPool] = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = ConnectionPool(
            settings.database_url,
            min_size=0,
            max_size=5,
            kwargs={"row_factory": dict_row, "autocommit": False},
            open=True,
        )
    return _pool


@contextmanager
def get_conn(tenant_id: Optional[str] = None, role: str = "anonymous") -> Iterator[psycopg.Connection]:
    """Yield a connection scoped to the given tenant for the lifetime of the
    `with` block, committing on success and rolling back on error."""
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('app.tenant_id', %s, false)", (tenant_id or "",))
            cur.execute("SELECT set_config('app.role', %s, false)", (role,))
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


@contextmanager
def get_system_conn() -> Iterator[psycopg.Connection]:
    """A connection with RLS bypassed (role=super_admin) for operations that
    must run before a tenant is known — user lookup during login, tenant
    creation during signup, and cross-tenant super_admin/cron operations.
    Never exposed directly to a request handler based on client input."""
    with get_conn(tenant_id=None, role="super_admin") as conn:
        yield conn
