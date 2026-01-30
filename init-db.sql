-- Initialize TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Grant necessary privileges
GRANT ALL PRIVILEGES ON DATABASE trading_db TO trading_user;
