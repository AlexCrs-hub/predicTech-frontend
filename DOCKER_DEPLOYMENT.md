# PredictTech Frontend - Docker Deployment Guide

## Overview

This directory contains Docker configuration files for deploying the PredictTech frontend React application using Vite.

## Files

- **Dockerfile**: Multi-stage build configuration
  - Stage 1: Builds the React app with Node.js
  - Stage 2: Serves the app with Nginx for optimal performance
  
- **nginx.conf**: Nginx configuration for SPA routing and security headers

- **docker-compose.yml**: Docker Compose setup for easy local testing and deployment

- **.dockerignore**: Excluded files from Docker build context

- **.env.example**: Template for environment variables

## Quick Start

### Building the Docker Image

```bash
docker build -t predictech-frontend:latest .
```

### Running Container Directly

```bash
docker run -p 80:80 predictech-frontend:latest
```

### Using Docker Compose (Recommended)

```bash
docker-compose up --build
```

Visit `http://localhost` in your browser.

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
VITE_API_URL=http://your-backend-api.com
VITE_API_BASE_PATH=/api
VITE_WS_URL=ws://your-backend-api.com
```

### With Docker Compose

```bash
docker-compose up -e VITE_API_URL=https://api.example.com
```

Or update the `docker-compose.yml` environment section directly.

## Production Deployment

### Image Size Optimization

The multi-stage build keeps the final image lean:
- Only Nginx and built assets are included (Stage 2)
- Build dependencies are not included in final image

### Performance Features

- **Gzip Compression**: Enabled for CSS, JS, JSON
- **Browser Caching**: 
  - Static assets cached for 1 year
  - index.html cached for 1 hour
- **Security Headers**: CORS, XSS protection, and more

### Health Checks

Container includes a health check that pings the Nginx server every 30 seconds.

## Development

For local development without Docker:

```bash
npm install
npm run dev
```

## Troubleshooting

### Port Already in Use

```bash
# Use a different port
docker run -p 3000:80 predictech-frontend:latest
```

### WebSocket Connection Issues

Ensure your backend WebSocket URL is correctly configured in the environment:

```bash
docker-compose up -e VITE_WS_URL=wss://your-domain.com
```

### Build Failures

Ensure you have:
- Node.js 20+ installed (for local builds)
- All dependencies: `npm ci`
- Valid TypeScript: `npm run lint`

## Notes

- The app uses **Vite** for fast builds
- **React Router** handles SPA routing (nginx configured to support this)
- **WebSocket** support included for real-time data (sockjs-client, @stomp/stompjs)
- **Tailwind CSS** pre-configured
