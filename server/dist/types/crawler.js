"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.ParseError = exports.NetworkError = exports.TimeoutError = exports.CrawlerError = void 0;
class CrawlerError extends Error {
    constructor(message, code, url, platform) {
        super(message);
        this.code = code;
        this.url = url;
        this.platform = platform;
        this.name = 'CrawlerError';
    }
}
exports.CrawlerError = CrawlerError;
class TimeoutError extends CrawlerError {
    constructor(url, timeout) {
        super(`Timeout after ${timeout}ms`, 'TIMEOUT', url);
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
class NetworkError extends CrawlerError {
    constructor(url, message) {
        super(`Network error: ${message}`, 'NETWORK_ERROR', url);
        this.name = 'NetworkError';
    }
}
exports.NetworkError = NetworkError;
class ParseError extends CrawlerError {
    constructor(url, field, message) {
        super(`Failed to parse ${field}: ${message}`, 'PARSE_ERROR', url);
        this.name = 'ParseError';
    }
}
exports.ParseError = ParseError;
class RateLimitError extends CrawlerError {
    constructor(platform, retryAfter) {
        super(`Rate limit exceeded for ${platform}${retryAfter ? `, retry after ${retryAfter}s` : ''}`, 'RATE_LIMIT', undefined, platform);
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
//# sourceMappingURL=crawler.js.map