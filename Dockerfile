FROM python:3.11-slim

WORKDIR /app

COPY . .

EXPOSE 10000

CMD ["sh", "-c", "python app.py --host 0.0.0.0 --port ${PORT:-10000}"]
