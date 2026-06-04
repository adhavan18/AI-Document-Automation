FROM python:3.11-slim

# System packages needed by the pipeline
RUN apt-get update && apt-get install -y --no-install-recommends \
        poppler-utils \
        tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads

# Default command — overridden per-service in docker-compose.yml
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
