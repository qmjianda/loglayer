# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS frontend-build

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

ENV GEMINI_API_KEY="" \
    VITE_TIMING=""
COPY frontend ./frontend
COPY tsconfig.json vite.config.ts ./

RUN npm run build

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --exclude=.env --exclude=.env.* backend ./backend
COPY --exclude=.env --exclude=.env.* bin ./bin
COPY --from=frontend-build /src/dist ./backend/www

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 12345

CMD ["python", "backend/main.py", "--no-ui", "--host", "0.0.0.0", "--port", "12345"]
