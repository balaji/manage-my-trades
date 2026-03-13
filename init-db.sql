-- Initialize TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Grant necessary privileges
GRANT ALL PRIVILEGES ON DATABASE trading_db TO trading_user;

-- Create market data database
CREATE DATABASE market_data_db;
\connect market_data_db
CREATE EXTENSION IF NOT EXISTS timescaledb;
GRANT ALL PRIVILEGES ON DATABASE market_data_db TO trading_user;
\connect trading_db
