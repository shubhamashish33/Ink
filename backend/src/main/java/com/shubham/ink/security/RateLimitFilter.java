package com.shubham.ink.security;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shubham.ink.common.exception.ApiErrorResponse;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Pattern IP_ADDRESS = Pattern.compile("[0-9a-fA-F:.]{1,45}");

    private final Map<String, BucketState> buckets = new ConcurrentHashMap<>();
    private final RateLimitProperties properties;
    private final ObjectMapper objectMapper;
    private final Bucket globalAuthBucket;
    private final Bucket overflowBucket;
    private final AtomicLong requestsSinceCleanup = new AtomicLong();

    public RateLimitFilter(RateLimitProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.globalAuthBucket = createBucket(properties.authGlobalCapacity(), properties.authGlobalRefillMinutes());
        this.overflowBucket = createBucket(properties.authCapacity(), properties.authRefillMinutes());
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {

       if (!isAuthEndpoint(request)) {
           filterChain.doFilter(request, response);
           return;
       }

       if (!globalAuthBucket.tryConsume(1)) {
           writeRateLimitResponse(request, response);
           return;
       }

       Bucket bucket = getBucket(buildKey(request));

       if (bucket.tryConsume(1)) {
           filterChain.doFilter(request, response);
           return;
       }

       writeRateLimitResponse(request, response);
    }

    private boolean isAuthEndpoint(HttpServletRequest request) {
        String path = request.getRequestURI();

        return path.equals("/api/auth/login") || path.equals("/api/auth/register");
    }

    private String buildKey(HttpServletRequest request) {
        return "auth:" + getClientIp(request);
    }

    private String getClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");

        if (properties.trustForwardedFor() && forwardedFor != null && !forwardedFor.isBlank()) {
            String forwardedClient = forwardedFor.split(",")[0].trim();
            if (IP_ADDRESS.matcher(forwardedClient).matches()) {
                return forwardedClient;
            }
        }

        return request.getRemoteAddr();
    }

    private Bucket getBucket(String key) {
        Instant now = Instant.now();
        BucketState existing = buckets.get(key);
        if (existing != null) {
            existing.lastAccess = now;
            return existing.bucket;
        }

        cleanupExpiredBuckets(now);
        if (buckets.size() >= properties.maxBuckets()) {
            return overflowBucket;
        }

        BucketState created = new BucketState(createBucket(properties.authCapacity(), properties.authRefillMinutes()), now);
        BucketState resolved = buckets.putIfAbsent(key, created);
        return resolved == null ? created.bucket : resolved.bucket;
    }

    private void cleanupExpiredBuckets(Instant now) {
        if (requestsSinceCleanup.incrementAndGet() % 100 != 0 && buckets.size() < properties.maxBuckets()) {
            return;
        }

        Instant expiry = now.minus(Duration.ofMinutes(properties.bucketExpiryMinutes()));
        buckets.entrySet().removeIf(entry -> entry.getValue().lastAccess.isBefore(expiry));
    }

    private Bucket createBucket(long capacity, long refillMinutes) {
        Refill refill = Refill.greedy(capacity, Duration.ofMinutes(refillMinutes));

        Bandwidth limit = Bandwidth.classic(capacity, refill);

        return Bucket.builder().addLimit(limit).build();
    }

    private void writeRateLimitResponse(HttpServletRequest request, HttpServletResponse response) throws IOException {
        ApiErrorResponse errorResponse = new ApiErrorResponse(
            Instant.now(),
            HttpStatus.TOO_MANY_REQUESTS.value(),
            HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
            "Too many requests. Please try again later",
            request.getRequestURI(),
            null
        );

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json");
        response.setHeader("Retry-After", String.valueOf(Duration.ofMinutes(properties.authRefillMinutes()).toSeconds()));
        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }

    private static final class BucketState {
        private final Bucket bucket;
        private volatile Instant lastAccess;

        private BucketState(Bucket bucket, Instant lastAccess) {
            this.bucket = bucket;
            this.lastAccess = lastAccess;
        }
    }

}
