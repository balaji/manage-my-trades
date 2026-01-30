"""Initial migration

Revision ID: 001
Revises:
Create Date: 2026-01-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create strategies table
    op.create_table(
        'strategies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('strategy_type', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=False),
        sa.Column('config', postgresql.JSON(astext_type=sa.Text()), nullable=False, default={}),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_strategies_id'), 'strategies', ['id'], unique=False)
    op.create_index(op.f('ix_strategies_name'), 'strategies', ['name'], unique=True)

    # Create strategy_indicators table
    op.create_table(
        'strategy_indicators',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('strategy_id', sa.Integer(), nullable=False),
        sa.Column('indicator_name', sa.String(length=100), nullable=False),
        sa.Column('parameters', postgresql.JSON(astext_type=sa.Text()), nullable=False, default={}),
        sa.Column('usage', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['strategy_id'], ['strategies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_strategy_indicators_id'), 'strategy_indicators', ['id'], unique=False)

    # Create backtests table
    op.create_table(
        'backtests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('strategy_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('symbols', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('initial_capital', sa.Float(), nullable=False),
        sa.Column('timeframe', sa.String(length=10), nullable=False, default='1d'),
        sa.Column('commission', sa.Float(), nullable=True, default=0.0),
        sa.Column('slippage', sa.Float(), nullable=True, default=0.001),
        sa.Column('status', sa.String(length=50), nullable=True, default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['strategy_id'], ['strategies.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_backtests_id'), 'backtests', ['id'], unique=False)
    op.create_index(op.f('ix_backtests_start_date'), 'backtests', ['start_date'], unique=False)
    op.create_index(op.f('ix_backtests_end_date'), 'backtests', ['end_date'], unique=False)

    # Create backtest_results table
    op.create_table(
        'backtest_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('backtest_id', sa.Integer(), nullable=False),
        sa.Column('total_return', sa.Float(), nullable=False),
        sa.Column('total_return_pct', sa.Float(), nullable=False),
        sa.Column('sharpe_ratio', sa.Float(), nullable=True),
        sa.Column('max_drawdown', sa.Float(), nullable=False),
        sa.Column('max_drawdown_pct', sa.Float(), nullable=False),
        sa.Column('win_rate', sa.Float(), nullable=False),
        sa.Column('profit_factor', sa.Float(), nullable=True),
        sa.Column('total_trades', sa.Integer(), nullable=False),
        sa.Column('winning_trades', sa.Integer(), nullable=False),
        sa.Column('losing_trades', sa.Integer(), nullable=False),
        sa.Column('avg_win', sa.Float(), nullable=True),
        sa.Column('avg_loss', sa.Float(), nullable=True),
        sa.Column('avg_trade_duration', sa.Float(), nullable=True),
        sa.Column('final_capital', sa.Float(), nullable=False),
        sa.Column('equity_curve', postgresql.JSON(astext_type=sa.Text()), nullable=False, default={}),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['backtest_id'], ['backtests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('backtest_id')
    )
    op.create_index(op.f('ix_backtest_results_id'), 'backtest_results', ['id'], unique=False)

    # Create trades table
    op.create_table(
        'trades',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('backtest_id', sa.Integer(), nullable=True),
        sa.Column('strategy_id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('side', sa.String(length=10), nullable=False),
        sa.Column('trade_type', sa.String(length=20), nullable=False),
        sa.Column('entry_date', sa.DateTime(), nullable=False),
        sa.Column('entry_price', sa.Float(), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('entry_order_id', sa.String(length=100), nullable=True),
        sa.Column('exit_date', sa.DateTime(), nullable=True),
        sa.Column('exit_price', sa.Float(), nullable=True),
        sa.Column('exit_order_id', sa.String(length=100), nullable=True),
        sa.Column('pnl', sa.Float(), nullable=True),
        sa.Column('pnl_pct', sa.Float(), nullable=True),
        sa.Column('commission', sa.Float(), nullable=True, default=0.0),
        sa.Column('status', sa.String(length=20), nullable=False, default='open'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['backtest_id'], ['backtests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['strategy_id'], ['strategies.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_trades_id'), 'trades', ['id'], unique=False)
    op.create_index(op.f('ix_trades_symbol'), 'trades', ['symbol'], unique=False)
    op.create_index(op.f('ix_trades_entry_date'), 'trades', ['entry_date'], unique=False)
    op.create_index(op.f('ix_trades_backtest_id'), 'trades', ['backtest_id'], unique=False)

    # Create signals table
    op.create_table(
        'signals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('strategy_id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('signal_type', sa.String(length=20), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('strength', sa.Float(), nullable=True),
        sa.Column('indicators', postgresql.JSON(astext_type=sa.Text()), nullable=True, default={}),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True, default={}),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['strategy_id'], ['strategies.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_signals_id'), 'signals', ['id'], unique=False)
    op.create_index(op.f('ix_signals_symbol'), 'signals', ['symbol'], unique=False)
    op.create_index(op.f('ix_signals_timestamp'), 'signals', ['timestamp'], unique=False)

    # Create positions table
    op.create_table(
        'positions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('avg_entry_price', sa.Float(), nullable=False),
        sa.Column('current_price', sa.Float(), nullable=True),
        sa.Column('market_value', sa.Float(), nullable=True),
        sa.Column('unrealized_pnl', sa.Float(), nullable=True),
        sa.Column('unrealized_pnl_pct', sa.Float(), nullable=True),
        sa.Column('cost_basis', sa.Float(), nullable=False),
        sa.Column('side', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('symbol')
    )
    op.create_index(op.f('ix_positions_id'), 'positions', ['id'], unique=False)
    op.create_index(op.f('ix_positions_symbol'), 'positions', ['symbol'], unique=True)

    # Create orders table
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alpaca_order_id', sa.String(length=100), nullable=True),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('side', sa.String(length=10), nullable=False),
        sa.Column('order_type', sa.String(length=20), nullable=False),
        sa.Column('time_in_force', sa.String(length=10), nullable=False),
        sa.Column('limit_price', sa.Float(), nullable=True),
        sa.Column('stop_price', sa.Float(), nullable=True),
        sa.Column('filled_qty', sa.Float(), nullable=True, default=0.0),
        sa.Column('filled_avg_price', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('submitted_at', sa.DateTime(), nullable=False),
        sa.Column('filled_at', sa.DateTime(), nullable=True),
        sa.Column('canceled_at', sa.DateTime(), nullable=True),
        sa.Column('failed_at', sa.DateTime(), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True, default={}),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_orders_id'), 'orders', ['id'], unique=False)
    op.create_index(op.f('ix_orders_alpaca_order_id'), 'orders', ['alpaca_order_id'], unique=True)
    op.create_index(op.f('ix_orders_symbol'), 'orders', ['symbol'], unique=False)

    # Create ml_models table
    op.create_table(
        'ml_models',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('model_type', sa.String(length=100), nullable=False),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('symbols', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('features', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('hyperparameters', postgresql.JSON(astext_type=sa.Text()), nullable=False, default={}),
        sa.Column('trained_at', sa.DateTime(), nullable=True),
        sa.Column('training_duration', sa.Float(), nullable=True),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('train_start_date', sa.DateTime(), nullable=True),
        sa.Column('train_end_date', sa.DateTime(), nullable=True),
        sa.Column('test_start_date', sa.DateTime(), nullable=True),
        sa.Column('test_end_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ml_models_id'), 'ml_models', ['id'], unique=False)
    op.create_index(op.f('ix_ml_models_name'), 'ml_models', ['name'], unique=True)

    # Create ml_model_metrics table
    op.create_table(
        'ml_model_metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('model_id', sa.Integer(), nullable=False),
        sa.Column('dataset_type', sa.String(length=20), nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('precision', sa.Float(), nullable=True),
        sa.Column('recall', sa.Float(), nullable=True),
        sa.Column('f1_score', sa.Float(), nullable=True),
        sa.Column('roc_auc', sa.Float(), nullable=True),
        sa.Column('confusion_matrix', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('mse', sa.Float(), nullable=True),
        sa.Column('rmse', sa.Float(), nullable=True),
        sa.Column('mae', sa.Float(), nullable=True),
        sa.Column('r2_score', sa.Float(), nullable=True),
        sa.Column('class_distribution', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('feature_importance', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ml_model_metrics_id'), 'ml_model_metrics', ['id'], unique=False)
    op.create_index(op.f('ix_ml_model_metrics_model_id'), 'ml_model_metrics', ['model_id'], unique=False)

    # Create market_data table
    op.create_table(
        'market_data',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('timeframe', sa.String(length=10), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('open', sa.Float(), nullable=False),
        sa.Column('high', sa.Float(), nullable=False),
        sa.Column('low', sa.Float(), nullable=False),
        sa.Column('close', sa.Float(), nullable=False),
        sa.Column('volume', sa.Float(), nullable=False),
        sa.Column('vwap', sa.Float(), nullable=True),
        sa.Column('trade_count', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_market_data_id'), 'market_data', ['id'], unique=False)
    op.create_index(op.f('ix_market_data_symbol'), 'market_data', ['symbol'], unique=False)
    op.create_index(op.f('ix_market_data_timeframe'), 'market_data', ['timeframe'], unique=False)
    op.create_index(op.f('ix_market_data_timestamp'), 'market_data', ['timestamp'], unique=False)
    op.create_index('ix_market_data_symbol_timeframe_timestamp', 'market_data', ['symbol', 'timeframe', 'timestamp'], unique=False)

    # Create indicator_cache table
    op.create_table(
        'indicator_cache',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('timeframe', sa.String(length=10), nullable=False),
        sa.Column('indicator_name', sa.String(length=100), nullable=False),
        sa.Column('indicator_params_hash', sa.String(length=64), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_indicator_cache_id'), 'indicator_cache', ['id'], unique=False)
    op.create_index(op.f('ix_indicator_cache_symbol'), 'indicator_cache', ['symbol'], unique=False)
    op.create_index(op.f('ix_indicator_cache_timeframe'), 'indicator_cache', ['timeframe'], unique=False)
    op.create_index(op.f('ix_indicator_cache_indicator_name'), 'indicator_cache', ['indicator_name'], unique=False)
    op.create_index(op.f('ix_indicator_cache_timestamp'), 'indicator_cache', ['timestamp'], unique=False)
    op.create_index('ix_indicator_cache_lookup', 'indicator_cache', ['symbol', 'timeframe', 'indicator_name', 'indicator_params_hash', 'timestamp'], unique=False)

    # Create portfolio_history table
    op.create_table(
        'portfolio_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('equity', sa.Float(), nullable=False),
        sa.Column('cash', sa.Float(), nullable=False),
        sa.Column('positions_value', sa.Float(), nullable=False),
        sa.Column('profit_loss', sa.Float(), nullable=False),
        sa.Column('profit_loss_pct', sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_portfolio_history_id'), 'portfolio_history', ['id'], unique=False)
    op.create_index(op.f('ix_portfolio_history_timestamp'), 'portfolio_history', ['timestamp'], unique=False)


def downgrade() -> None:
    op.drop_table('portfolio_history')
    op.drop_table('indicator_cache')
    op.drop_table('market_data')
    op.drop_table('ml_model_metrics')
    op.drop_table('ml_models')
    op.drop_table('orders')
    op.drop_table('positions')
    op.drop_table('signals')
    op.drop_table('trades')
    op.drop_table('backtest_results')
    op.drop_table('backtests')
    op.drop_table('strategy_indicators')
    op.drop_table('strategies')
