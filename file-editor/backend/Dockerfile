FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -m appuser

# Copy application code
COPY --chown=appuser:appuser . .

RUN chown -R appuser:appuser /app

# Ensure template directory exists and is empty
RUN mkdir -p template && rm -rf template/*

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
