FROM ghcr.io/astral-sh/uv:python3.13-trixie-slim

RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY . /app

# Disable development dependencies
ENV UV_NO_DEV=1

# Sync the project into a new environment, asserting the lockfile is up to date
WORKDIR /app
RUN uv sync --locked

# Create storage directories
RUN mkdir -p /app/storage/models /app/storage/data

# Expose port
EXPOSE 8000

# Run the application
CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]