# Interview System Backend Server

A TypeScript-based backend crawler service for the interview management system.

## Features

- **PDF Processing**: Parse and extract text from PDF resumes
- **Web Crawling**: Crawl job positions from various recruitment platforms
- **Caching**: Redis-based caching for improved performance
- **Rate Limiting**: Configurable rate limiting to prevent abuse
- **Health Monitoring**: Comprehensive health check endpoints
- **Type Safety**: Full TypeScript support with strict typing
- **Security**: Helmet, CORS, and input validation

## Project Structure

```
server/
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment variables template
└── src/
    ├── index.ts          # Main server entry point
    ├── config/           # Configuration files
    │   ├── config.ts     # Application configuration
    │   ├── logger.ts     # Winston logging setup
    │   ├── rateLimiter.ts # Rate limiting configuration
    │   └── redis.ts      # Redis connection management
    ├── routes/           # API route handlers
    │   ├── health.ts     # Health check endpoints
    │   ├── pdf.ts        # PDF processing endpoints
    │   └── crawler.ts    # Web crawler endpoints
    ├── services/         # Business logic services
    │   ├── PdfService.ts     # PDF parsing service
    │   ├── CrawlerService.ts # Web crawling service
    │   └── CacheService.ts   # Redis caching service
    └── types/            # TypeScript type definitions
        ├── index.ts      # Main types export
        ├── api.ts        # API response types
        ├── crawler.ts    # Crawler-related types
        └── validation.ts # Validation schemas and types
```

## Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

5. Ensure Redis is running:
   ```bash
   # Install Redis if not already installed
   # macOS: brew install redis
   # Ubuntu: sudo apt install redis-server
   
   # Start Redis
   redis-server
   ```

## Development

Start the development server with hot reload:

```bash
npm run dev
```

The server will start on `http://localhost:3001` (or the port specified in `.env`).

## Production

Build and run the production server:

```bash
# Build the project
npm run build

# Start the production server
npm start
```

## API Endpoints

### Health Checks

- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed system information
- `GET /api/health/ready` - Readiness probe (for Kubernetes)
- `GET /api/health/live` - Liveness probe (for Kubernetes)

### PDF Processing

- `POST /api/pdf/parse` - Parse PDF and extract text
- `POST /api/pdf/validate` - Validate PDF file
- `GET /api/pdf/info` - Get PDF service information

### Web Crawler

- `POST /api/crawler/job` - Crawl single job position
- `POST /api/crawler/jobs/batch` - Crawl multiple job positions
- `GET /api/crawler/status/:jobId` - Get crawl job status
- `GET /api/crawler/platforms` - Get supported platforms
- `GET /api/crawler/health` - Check crawler service health
- `DELETE /api/crawler/cache` - Clear crawler cache

## Configuration

Key environment variables:

```bash
# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Redis
REDIS_URL=redis://localhost:6379

# API Keys
GLM_API_KEY=your_api_key_here

# Crawler
CRAWLER_TIMEOUT=30000
CRAWLER_MAX_RETRIES=3

# Security
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760
```

## Supported Platforms

The crawler supports the following job platforms:

- **BOSS直聘** (`zhipin`) - zhipin.com
- **猎聘网** (`liepin`) - liepin.com  
- **拉勾网** (`lagou`) - lagou.com
- **前程无忧** (`51job`) - 51job.com
- **通用爬虫** (`generic`) - Any website with basic selectors

## Rate Limiting

Different endpoints have different rate limits:

- General endpoints: 100 requests per 15 minutes
- Crawler endpoints: 10 requests per minute
- Upload endpoints: 5 uploads per 5 minutes

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## Logging

Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)
- `logs/requests.log` (HTTP requests)

## Security Features

- Helmet for security headers
- CORS protection
- Rate limiting
- Input validation with Joi
- File upload restrictions
- Request sanitization

## Performance

- Redis caching for frequently accessed data
- Connection pooling for database connections
- Graceful shutdown handling
- Memory usage monitoring

## Docker Support

Create a Dockerfile for containerization:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Ensure Redis is running: `redis-cli ping`
   - Check Redis URL in environment variables

2. **Playwright Browser Not Found**
   - Install browsers: `npx playwright install chromium`
   - Ensure sufficient disk space

3. **PDF Parsing Failed**
   - Check file format and size limits
   - Verify pdf-parse dependency installation

4. **Rate Limit Exceeded**
   - Check rate limit configuration
   - Clear Redis cache if needed

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Follow TypeScript strict mode guidelines
2. Add types for all new features
3. Include error handling and logging
4. Write tests for new functionality
5. Update documentation as needed

## License

MIT