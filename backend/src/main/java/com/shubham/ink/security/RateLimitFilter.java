package com.shubham.ink.security;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final RateLimitProperties properties;
    private final ObjectMapper objectMapper;

    public RateLimitFilter(RateLimitProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
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

       String key = buildKey(request);
       Bucket bucket = buckets.computeIfAbsent(key, ignored -> createAuthBucket());

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

        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }

    private Bucket createAuthBucket() {
        Refill refill = Refill.greedy(properties.authCapacity(), Duration.ofMinutes(properties.authRefillMinutes()));

        Bandwidth limit = Bandwidth.classic(properties.authCapacity(), refill);

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
        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }

}
