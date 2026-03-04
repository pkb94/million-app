from logic import services


def test_db_crud_roundtrip(db_engine_and_session):
    uid = services.create_user("crud_user", "GoodPassword12")
    # save_trade should insert a row
    services.save_trade('AAPL', 'Stock', 'Swing Trade', 'Buy', 10, 150.0, '2025-01-01', user_id=uid)
    trades, cash, budget = services.load_data(user_id=uid)
    assert not trades.empty
    assert 'AAPL' in trades['symbol'].values

    # Delete the trade and ensure table is empty
    tid = int(trades.iloc[0]['id'])
    assert services.delete_trade(tid, user_id=uid) is True
    trades2, _, _ = services.load_data(user_id=uid)
    assert trades2.empty
