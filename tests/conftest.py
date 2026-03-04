import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

import database.models as dbmodels
import logic.services as services


@pytest.fixture(scope='function')
def db_engine_and_session(monkeypatch):
    """Provide a single shared in-memory SQLite engine for all domains.

    Using one engine with StaticPool means every session call shares the same
    connection and in-memory database, so cross-domain queries (e.g. Account on
    trades.db + StockHolding on portfolio.db) work correctly in tests.

    We patch both database.models and logic.services so every session factory
    and engine getter — however imported — returns our test engine/session.
    """
    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)

    # Create tables for every domain on the single shared engine
    dbmodels.UsersBase.metadata.create_all(engine)
    dbmodels.TradesBase.metadata.create_all(engine)
    dbmodels.PortfolioBase.metadata.create_all(engine)
    dbmodels.BudgetBase.metadata.create_all(engine)
    dbmodels.MarketsBase.metadata.create_all(engine)

    # Session factory that always returns a session on the shared engine
    def _sess():
        return Session()

    # 1. Patch engine getters on database.models
    monkeypatch.setattr(dbmodels, 'get_users_engine',     lambda: engine)
    monkeypatch.setattr(dbmodels, 'get_trades_engine',    lambda: engine)
    monkeypatch.setattr(dbmodels, 'get_portfolio_engine', lambda: engine)
    monkeypatch.setattr(dbmodels, 'get_budget_engine',    lambda: engine)
    monkeypatch.setattr(dbmodels, 'get_markets_engine',   lambda: engine)

    # 2. Patch session factories on database.models
    monkeypatch.setattr(dbmodels, 'get_users_session',     _sess)
    monkeypatch.setattr(dbmodels, 'get_trades_session',    _sess)
    monkeypatch.setattr(dbmodels, 'get_portfolio_session', _sess)
    monkeypatch.setattr(dbmodels, 'get_budget_session',    _sess)
    monkeypatch.setattr(dbmodels, 'get_markets_session',   _sess)

    # 3. Patch the same names on logic.services (imported as module-level locals)
    monkeypatch.setattr(services, 'get_users_engine',     lambda: engine)
    monkeypatch.setattr(services, 'get_trades_engine',    lambda: engine)
    monkeypatch.setattr(services, 'get_portfolio_engine', lambda: engine)
    monkeypatch.setattr(services, 'get_budget_engine',    lambda: engine)
    monkeypatch.setattr(services, 'get_markets_engine',   lambda: engine)
    monkeypatch.setattr(services, 'get_users_session',     _sess)
    monkeypatch.setattr(services, 'get_trades_session',    _sess)
    monkeypatch.setattr(services, 'get_portfolio_session', _sess)
    monkeypatch.setattr(services, 'get_budget_session',    _sess)
    monkeypatch.setattr(services, 'get_markets_session',   _sess)

    # 4. Null out services.engine so the legacy get_session() / _*_session()
    #    helpers fall through to the patched get_*_session functions above.
    monkeypatch.setattr(services, 'engine', None)

    yield engine, Session
