package com.shubham.ink.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.rate-limit")
public record RateLimitProperties(
    long authCapacity,
    long authRefillMinutes
) {
    
}
