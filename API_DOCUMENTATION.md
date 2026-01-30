# API Documentation Guide

## Overview

The Algorithmic ETF Trading API now includes comprehensive Swagger/OpenAPI documentation with enhanced metadata, examples, and interactive testing capabilities.

## Accessing the Documentation

### Swagger UI (Recommended for Testing)
- **URL**: http://localhost:8000/docs
- **Features**:
  - Interactive API testing
  - Try endpoints directly from browser
  - View request/response schemas
  - Copy cURL commands
  - See example requests and responses

### ReDoc (Recommended for Reading)
- **URL**: http://localhost:8000/redoc
- **Features**:
  - Clean, professional layout
  - Three-panel design
  - Better for understanding API structure
  - Includes all examples and schemas

### OpenAPI Schema
- **URL**: http://localhost:8000/openapi.json
- **Use Cases**:
  - Generate client SDKs
  - Import into Postman/Insomnia
  - Use with API testing tools

## What's Included

### Enhanced Metadata

The API documentation now includes:

1. **Detailed Descriptions**: Each endpoint has comprehensive documentation explaining:
   - Purpose and functionality
   - Request parameters and body structure
   - Return values and data types
   - Usage examples

2. **Organized by Tags**: Endpoints are grouped into logical categories:
   - **market-data**: Market data operations (OHLCV bars, quotes, symbol search)
   - **technical-analysis**: Technical indicator calculations
   - **health**: System health and status

3. **Response Examples**: Each endpoint includes example responses showing:
   - Success responses (200)
   - Error responses (400, 404, 500)
   - Data structure and format

4. **Request Examples**: Sample request bodies with realistic data

### Available Endpoints

#### Market Data (`/api/v1/market-data`)

1. **POST /bars** - Get OHLCV Bar Data
   - Fetch historical market data
   - Support for multiple symbols
   - Configurable timeframes (1m, 5m, 15m, 1h, 1d)
   - Optional caching

2. **GET /search** - Search Ticker Symbols
   - Search by symbol or company name
   - Returns symbol details (name, exchange, type)

3. **GET /quote/{symbol}** - Get Latest Quote
   - Real-time bid/ask/last prices
   - Timestamp information

#### Technical Analysis (`/api/v1/technical-analysis`)

1. **POST /calculate** - Calculate Technical Indicators
   - Support for multiple indicators in one request
   - Indicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic
   - Configurable parameters per indicator
   - Returns time-series data with calculated values

2. **GET /indicators** - List Supported Indicators
   - Get all available indicators
   - View default parameters
   - See parameter constraints

#### Health (`/health`)

1. **GET /health** - Health Check
   - System status
   - API version
   - Application name

## Using Swagger UI

### Step-by-Step Guide

1. **Start the Backend**
   ```bash
   docker-compose up -d backend
   ```

2. **Open Swagger UI**
   - Navigate to http://localhost:8000/docs in your browser

3. **Browse Endpoints**
   - Endpoints are organized by tags
   - Click on a tag to expand its endpoints
   - Click on an endpoint to see details

4. **Test an Endpoint**
   - Click "Try it out" button
   - Fill in required parameters
   - Modify the request body if needed
   - Click "Execute"
   - View the response below

### Example: Fetching Market Data

1. Go to **market-data** section
2. Click on **POST /api/v1/market-data/bars**
3. Click "Try it out"
4. Use this example request body:
   ```json
   {
     "symbols": ["SPY", "QQQ"],
     "start_date": "2024-01-01T00:00:00Z",
     "end_date": "2024-01-31T00:00:00Z",
     "timeframe": "1d"
   }
   ```
5. Click "Execute"
6. View the response with OHLCV data

### Example: Calculating Indicators

1. Go to **technical-analysis** section
2. Click on **POST /api/v1/technical-analysis/calculate**
3. Click "Try it out"
4. Use this example request body:
   ```json
   {
     "symbol": "SPY",
     "timeframe": "1d",
     "start_date": "2024-01-01T00:00:00Z",
     "end_date": "2024-12-31T00:00:00Z",
     "indicators": [
       {"name": "sma", "params": {"length": 20}},
       {"name": "rsi", "params": {"length": 14}},
       {"name": "macd", "params": {"fast": 12, "slow": 26, "signal": 9}}
     ]
   }
   ```
5. Click "Execute"
6. View calculated indicators in the response

## OpenAPI Features

### Request Validation
- Automatic validation of request data
- Clear error messages for invalid inputs
- Type checking and constraints

### Response Models
- Pydantic schemas define response structure
- Automatic serialization and validation
- Type hints for client generation

### Status Codes
- **200**: Success
- **400**: Bad Request (invalid parameters)
- **404**: Not Found (resource doesn't exist)
- **500**: Internal Server Error

## Generating API Clients

You can generate API clients in various languages using the OpenAPI schema:

### Using OpenAPI Generator

```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Generate Python client
openapi-generator-cli generate \
  -i http://localhost:8000/openapi.json \
  -g python \
  -o ./api-client-python

# Generate TypeScript client
openapi-generator-cli generate \
  -i http://localhost:8000/openapi.json \
  -g typescript-axios \
  -o ./api-client-typescript
```

### Using Swagger Codegen

```bash
# Generate Java client
swagger-codegen generate \
  -i http://localhost:8000/openapi.json \
  -l java \
  -o ./api-client-java
```

## Importing into API Tools

### Postman
1. Open Postman
2. Click "Import"
3. Enter URL: http://localhost:8000/openapi.json
4. Click "Import"

### Insomnia
1. Open Insomnia
2. Click "Create" → "Import From" → "URL"
3. Enter: http://localhost:8000/openapi.json
4. Click "Fetch and Import"

## Best Practices

1. **Always Check Documentation First**
   - Review endpoint details before implementation
   - Check required vs optional parameters
   - Review response schemas

2. **Use Try It Out Feature**
   - Test endpoints before writing code
   - Verify request/response format
   - Understand error responses

3. **Copy cURL Commands**
   - Use the generated cURL command for debugging
   - Share with team members
   - Include in documentation

4. **Review Examples**
   - Study example requests and responses
   - Use them as templates for your code
   - Understand expected data formats

## Troubleshooting

### Documentation Not Loading

```bash
# Check if backend is running
docker-compose ps backend

# View backend logs
docker-compose logs backend

# Restart backend
docker-compose restart backend
```

### Endpoints Not Appearing

```bash
# Rebuild backend
docker-compose up -d --build backend

# Check for syntax errors
docker-compose exec backend python -m py_compile app/main.py
```

### CORS Issues

The API is configured with CORS for `http://localhost:3000`. If accessing from a different origin, update `CORS_ORIGINS` in `.env`:

```env
CORS_ORIGINS=["http://localhost:3000", "http://your-domain.com"]
```

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [ReDoc Documentation](https://redocly.com/redoc)

## Support

For issues with the API documentation:
1. Check the backend logs: `docker-compose logs backend`
2. Verify the API is running: http://localhost:8000/health
3. Check the OpenAPI schema: http://localhost:8000/openapi.json
