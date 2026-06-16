# syntax=docker/dockerfile:1
#
# CrewAI sidecar for MarketIQ. Like the Node app, this sits behind a Netskope
# TLS-inspecting proxy presenting a self-signed CA. The container must trust it
# or all HTTPS (PyPI at build time; OpenAI at runtime) fails with a self-signed
# cert error. netskope-ca.crt holds the corporate CA chain.

FROM python:3.12-slim AS runtime

# Trust the corporate CA: dropping it in the ca-certificates dir and running
# update-ca-certificates merges it INTO the system bundle (which keeps the public
# CAs too), so SSL_CERT_FILE can point at one complete bundle.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates build-essential curl \
  && rm -rf /var/lib/apt/lists/*
COPY netskope-ca.crt /usr/local/share/ca-certificates/netskope-ca.crt
RUN update-ca-certificates

# Make Python TLS (httpx/openai/litellm) and pip use the merged system bundle.
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    PIP_CERT=/etc/ssl/certs/ca-certificates.crt \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
