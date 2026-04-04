"""Convert all trading_db primary keys from Integer to UUID."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create uuid-ossp extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # Migration order: leaf tables first (no foreign keys pointing to them)
    # 1. ml_model_metrics (references ml_models)
    # 2. positions (no foreign keys)
    # 3. orders (no foreign keys)
    # 4. signals (references backtest_results)
    # 5. trades (references backtests and strategies)
    # 6. backtest_results (references backtests)
    # 7. backtests (references strategies and users)
    # 8. strategies (references users)
    # 9. ml_models (no foreign keys)
    # 10. portfolio_history (no foreign keys)
    # 11. users (no foreign keys in trading_db)

    # 1. ml_models table
    op.add_column("ml_models", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE ml_models SET new_id = uuid_generate_v4()")
    op.alter_column("ml_models", "new_id", nullable=False)
    op.drop_constraint("ml_models_pkey", "ml_models", type_="primary key")
    op.drop_column("ml_models", "id")
    op.rename_table("ml_models", "ml_models_temp")
    op.execute(
        """
        ALTER TABLE ml_models_temp RENAME COLUMN new_id TO id;
        ALTER TABLE ml_models_temp ADD PRIMARY KEY (id);
        ALTER TABLE ml_models_temp RENAME TO ml_models;
        """
    )

    # 2. ml_model_metrics table - update FK to ml_models
    op.add_column("ml_model_metrics", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.add_column("ml_model_metrics", sa.Column("new_model_id", UUID(as_uuid=True), nullable=True))
    op.execute(
        """
        UPDATE ml_model_metrics m
        SET new_id = uuid_generate_v4(),
            new_model_id = ml.id
        FROM ml_models ml
        WHERE m.model_id = ml.id
        """
    )
    op.alter_column("ml_model_metrics", "new_id", nullable=False)
    op.alter_column("ml_model_metrics", "new_model_id", nullable=False)
    op.drop_constraint("ml_model_metrics_pkey", "ml_model_metrics", type_="primary key")
    op.drop_column("ml_model_metrics", "id")
    op.drop_column("ml_model_metrics", "model_id")
    op.rename_table("ml_model_metrics", "ml_model_metrics_temp")
    op.execute(
        """
        ALTER TABLE ml_model_metrics_temp RENAME COLUMN new_id TO id;
        ALTER TABLE ml_model_metrics_temp RENAME COLUMN new_model_id TO model_id;
        ALTER TABLE ml_model_metrics_temp ADD PRIMARY KEY (id);
        ALTER TABLE ml_model_metrics_temp ADD FOREIGN KEY (model_id) REFERENCES ml_models(id);
        ALTER TABLE ml_model_metrics_temp RENAME TO ml_model_metrics;
        """
    )

    # 3. positions table
    op.add_column("positions", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE positions SET new_id = uuid_generate_v4()")
    op.alter_column("positions", "new_id", nullable=False)
    op.drop_constraint("positions_pkey", "positions", type_="primary key")
    op.drop_column("positions", "id")
    op.rename_table("positions", "positions_temp")
    op.execute(
        """
        ALTER TABLE positions_temp RENAME COLUMN new_id TO id;
        ALTER TABLE positions_temp ADD PRIMARY KEY (id);
        ALTER TABLE positions_temp RENAME TO positions;
        """
    )

    # 4. orders table
    op.add_column("orders", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE orders SET new_id = uuid_generate_v4()")
    op.alter_column("orders", "new_id", nullable=False)
    op.drop_constraint("orders_pkey", "orders", type_="primary key")
    op.drop_column("orders", "id")
    op.rename_table("orders", "orders_temp")
    op.execute(
        """
        ALTER TABLE orders_temp RENAME COLUMN new_id TO id;
        ALTER TABLE orders_temp ADD PRIMARY KEY (id);
        ALTER TABLE orders_temp RENAME TO orders;
        """
    )

    # 5. users table (must be before strategies and backtests)
    op.add_column("users", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE users SET new_id = uuid_generate_v4()")
    op.alter_column("users", "new_id", nullable=False)
    op.drop_constraint("users_pkey", "users", type_="primary key")
    op.drop_column("users", "id")
    op.rename_table("users", "users_temp")
    op.execute(
        """
        ALTER TABLE users_temp RENAME COLUMN new_id TO id;
        ALTER TABLE users_temp ADD PRIMARY KEY (id);
        ALTER TABLE users_temp RENAME TO users;
        """
    )

    # 6. strategies table - update user_id FK
    op.add_column("strategies", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.add_column("strategies", sa.Column("new_user_id", UUID(as_uuid=True), nullable=True))
    op.execute(
        """
        UPDATE strategies s
        SET new_id = uuid_generate_v4(),
            new_user_id = u.id
        FROM users u
        WHERE s.user_id = u.id
        """
    )
    op.alter_column("strategies", "new_id", nullable=False)
    op.alter_column("strategies", "new_user_id", nullable=False)
    op.drop_constraint("uq_strategies_user_id_name", "strategies")
    op.drop_constraint("strategies_pkey", "strategies", type_="primary key")
    op.drop_constraint("strategies_user_id_fkey", "strategies", type_="foreignkey")
    op.drop_column("strategies", "id")
    op.drop_column("strategies", "user_id")
    op.rename_table("strategies", "strategies_temp")
    op.execute(
        """
        ALTER TABLE strategies_temp RENAME COLUMN new_id TO id;
        ALTER TABLE strategies_temp RENAME COLUMN new_user_id TO user_id;
        ALTER TABLE strategies_temp ADD PRIMARY KEY (id);
        ALTER TABLE strategies_temp ADD UNIQUE (user_id, name);
        ALTER TABLE strategies_temp ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        ALTER TABLE strategies_temp RENAME TO strategies;
        """
    )

    # 7. backtests table - update strategy_id and user_id FK
    op.add_column("backtests", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.add_column("backtests", sa.Column("new_strategy_id", UUID(as_uuid=True), nullable=True))
    op.add_column("backtests", sa.Column("new_user_id", UUID(as_uuid=True), nullable=True))
    op.execute(
        """
        UPDATE backtests b
        SET new_id = uuid_generate_v4(),
            new_strategy_id = s.id,
            new_user_id = u.id
        FROM strategies s, users u
        WHERE b.strategy_id = s.id AND b.user_id = u.id
        """
    )
    op.alter_column("backtests", "new_id", nullable=False)
    op.alter_column("backtests", "new_strategy_id", nullable=False)
    op.alter_column("backtests", "new_user_id", nullable=False)
    op.drop_constraint("backtests_pkey", "backtests", type_="primary key")
    op.drop_constraint("backtests_strategy_id_fkey", "backtests", type_="foreignkey")
    op.drop_constraint("backtests_user_id_fkey", "backtests", type_="foreignkey")
    op.drop_column("backtests", "id")
    op.drop_column("backtests", "strategy_id")
    op.drop_column("backtests", "user_id")
    op.rename_table("backtests", "backtests_temp")
    op.execute(
        """
        ALTER TABLE backtests_temp RENAME COLUMN new_id TO id;
        ALTER TABLE backtests_temp RENAME COLUMN new_strategy_id TO strategy_id;
        ALTER TABLE backtests_temp RENAME COLUMN new_user_id TO user_id;
        ALTER TABLE backtests_temp ADD PRIMARY KEY (id);
        ALTER TABLE backtests_temp ADD FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE;
        ALTER TABLE backtests_temp ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        ALTER TABLE backtests_temp RENAME TO backtests;
        """
    )

    # 8. backtest_results table - update backtest_id FK
    op.add_column("backtest_results", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.add_column("backtest_results", sa.Column("new_backtest_id", UUID(as_uuid=True), nullable=True))
    op.execute(
        """
        UPDATE backtest_results br
        SET new_id = uuid_generate_v4(),
            new_backtest_id = b.id
        FROM backtests b
        WHERE br.backtest_id = b.id
        """
    )
    op.alter_column("backtest_results", "new_id", nullable=False)
    op.alter_column("backtest_results", "new_backtest_id", nullable=False)
    op.drop_constraint("backtest_results_pkey", "backtest_results", type_="primary key")
    op.drop_constraint("backtest_results_backtest_id_fkey", "backtest_results", type_="foreignkey")
    op.drop_column("backtest_results", "id")
    op.drop_column("backtest_results", "backtest_id")
    op.rename_table("backtest_results", "backtest_results_temp")
    op.execute(
        """
        ALTER TABLE backtest_results_temp RENAME COLUMN new_id TO id;
        ALTER TABLE backtest_results_temp RENAME COLUMN new_backtest_id TO backtest_id;
        ALTER TABLE backtest_results_temp ADD PRIMARY KEY (id);
        ALTER TABLE backtest_results_temp ADD UNIQUE (backtest_id);
        ALTER TABLE backtest_results_temp ADD FOREIGN KEY (backtest_id) REFERENCES backtests(id) ON DELETE CASCADE;
        ALTER TABLE backtest_results_temp RENAME TO backtest_results;
        """
    )

    # 9. signals table - update backtest_result_id FK
    op.add_column("signals", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.add_column("signals", sa.Column("new_backtest_result_id", UUID(as_uuid=True), nullable=True))
    op.execute(
        """
        UPDATE signals s
        SET new_id = uuid_generate_v4(),
            new_backtest_result_id = br.id
        FROM backtest_results br
        WHERE s.backtest_result_id = br.id
        """
    )
    op.alter_column("signals", "new_id", nullable=False)
    op.alter_column("signals", "new_backtest_result_id", nullable=False)
    op.drop_constraint("signals_pkey", "signals", type_="primary key")
    op.drop_constraint("signals_backtest_result_id_fkey", "signals", type_="foreignkey")
    op.drop_column("signals", "id")
    op.drop_column("signals", "backtest_result_id")
    op.rename_table("signals", "signals_temp")
    op.execute(
        """
        ALTER TABLE signals_temp RENAME COLUMN new_id TO id;
        ALTER TABLE signals_temp RENAME COLUMN new_backtest_result_id TO backtest_result_id;
        ALTER TABLE signals_temp ADD PRIMARY KEY (id);
        ALTER TABLE signals_temp ADD FOREIGN KEY (backtest_result_id) REFERENCES backtest_results(id) ON DELETE CASCADE;
        ALTER TABLE signals_temp RENAME TO signals;
        """
    )

    # 10. trades table - update backtest_id and strategy_id FK
    op.add_column("trades", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.add_column("trades", sa.Column("new_backtest_id", UUID(as_uuid=True), nullable=True))
    op.add_column("trades", sa.Column("new_strategy_id", UUID(as_uuid=True), nullable=True))
    op.execute(
        """
        UPDATE trades t
        SET new_id = uuid_generate_v4(),
            new_backtest_id = b.id,
            new_strategy_id = s.id
        FROM backtests b, strategies s
        WHERE (t.backtest_id = b.id OR t.backtest_id IS NULL)
          AND t.strategy_id = s.id
        """
    )
    op.alter_column("trades", "new_id", nullable=False)
    op.alter_column("trades", "new_strategy_id", nullable=False)
    op.drop_constraint("trades_pkey", "trades", type_="primary key")
    op.drop_constraint("trades_backtest_id_fkey", "trades", type_="foreignkey")
    op.drop_constraint("trades_strategy_id_fkey", "trades", type_="foreignkey")
    op.drop_column("trades", "id")
    op.drop_column("trades", "backtest_id")
    op.drop_column("trades", "strategy_id")
    op.rename_table("trades", "trades_temp")
    op.execute(
        """
        ALTER TABLE trades_temp RENAME COLUMN new_id TO id;
        ALTER TABLE trades_temp RENAME COLUMN new_backtest_id TO backtest_id;
        ALTER TABLE trades_temp RENAME COLUMN new_strategy_id TO strategy_id;
        ALTER TABLE trades_temp ADD PRIMARY KEY (id);
        ALTER TABLE trades_temp ADD FOREIGN KEY (backtest_id) REFERENCES backtests(id) ON DELETE CASCADE;
        ALTER TABLE trades_temp ADD FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE;
        ALTER TABLE trades_temp RENAME TO trades;
        """
    )

    # 11. portfolio_history table
    op.add_column("portfolio_history", sa.Column("new_id", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE portfolio_history SET new_id = uuid_generate_v4()")
    op.alter_column("portfolio_history", "new_id", nullable=False)
    op.drop_constraint("portfolio_history_pkey", "portfolio_history", type_="primary key")
    op.drop_column("portfolio_history", "id")
    op.rename_table("portfolio_history", "portfolio_history_temp")
    op.execute(
        """
        ALTER TABLE portfolio_history_temp RENAME COLUMN new_id TO id;
        ALTER TABLE portfolio_history_temp ADD PRIMARY KEY (id);
        ALTER TABLE portfolio_history_temp RENAME TO portfolio_history;
        """
    )


def downgrade() -> None:
    raise NotImplementedError("This migration cannot be downgraded as it is not reversible.")
