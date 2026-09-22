# Ultra-lightweight Dockerfile for Kitab Audio Web App
FROM python:3.11-alpine

WORKDIR /app

# Copy application files
COPY . /app

# Run parser to ensure latest data is generated
RUN python scripts/parse_excel.py

# Expose port
EXPOSE 8080

# Environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Run server
CMD ["python", "server.py"]
