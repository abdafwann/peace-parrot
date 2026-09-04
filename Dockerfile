# Multi-stage Dockerfile for Roompeak (PeaceParrot) Backend
# Stage 1: Build
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev git

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary with optimizations
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w -extldflags '-static'" -o /app/server ./cmd/server

# Stage 2: Runtime
FROM alpine:3.21

# Install ca-certificates, tzdata, and sqlite tools for backups
RUN apk add --no-cache ca-certificates tzdata sqlite curl

# Create non-root user and directories
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# Copy binary and migrations from builder
COPY --from=builder /app/server /app/server
COPY --from=builder /app/migrations /app/migrations

# Create storage directories
RUN mkdir -p /app/data /app/uploads && \
    chown -R appuser:appgroup /app

USER appuser

# Environment variables
ENV SERVER_PORT=8080 \
    DB_PATH=/app/data/peace-parrot.db \
    MIGRATIONS_PATH=/app/migrations \
    SERVER_READ_TIMEOUT=30 \
    SERVER_WRITE_TIMEOUT=30

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/server"]
