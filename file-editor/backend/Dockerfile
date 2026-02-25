FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Allow any runtime UID to write to the template directory
RUN mkdir -p /app/template && chmod -R 777 /app/template

# Ensure template directory starts empty
RUN rm -rf /app/template/*

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
