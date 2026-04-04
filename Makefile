@PHONY: test-backend test-frontend test lint-backend lint-frontend lint format-backend format-frontend format all
default: all

test-backend:
	uv --directory backend run pytest

test-frontend:
	npm run test --prefix frontend

test: test-backend test-frontend

lint-backend:
	uv --directory backend run ruff check .

lint-frontend:
	npm run lint --prefix frontend

lint: lint-backend lint-frontend

format-backend:
	uv --directory backend run ruff format

format-frontend:
	npm run format --prefix frontend .

format: format-backend format-frontend

all: format lint test