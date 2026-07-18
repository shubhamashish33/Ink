package com.shubham.ink.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.FilterChain;

class RateLimitFilterTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(new RateLimitProperties(2, 1, 20, 1, 15, 100, true), objectMapper);
    }

    @Test
    void allowsRequestsThatAreNotRateLimited() throws Exception {
        AtomicInteger chainCalls = new AtomicInteger();
        MockHttpServletRequest request = request("/api/notes", "127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, countingChain(chainCalls));

        assertThat(chainCalls).hasValue(1);
        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
    }

    @Test
    void returnsTooManyRequestsAfterAuthCapacityIsExhausted() throws Exception {
        AtomicInteger chainCalls = new AtomicInteger();

        filter.doFilter(request("/api/auth/login", "127.0.0.1"),
                new MockHttpServletResponse(), countingChain(chainCalls));
        filter.doFilter(request("/api/auth/login", "127.0.0.1"),
                new MockHttpServletResponse(), countingChain(chainCalls));

        MockHttpServletResponse limitedResponse = new MockHttpServletResponse();
        filter.doFilter(request("/api/auth/login", "127.0.0.1"),
                limitedResponse, countingChain(chainCalls));

        JsonNode body = objectMapper.readTree(limitedResponse.getContentAsString());

        assertThat(chainCalls).hasValue(2);
        assertThat(limitedResponse.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(limitedResponse.getContentType()).startsWith("application/json");
        assertThat(body.get("status").asInt()).isEqualTo(429);
        assertThat(body.get("message").asText()).isEqualTo("Too many requests. Please try again later");
        assertThat(body.get("path").asText()).isEqualTo("/api/auth/login");
        assertThat(limitedResponse.getHeader("Retry-After")).isEqualTo("60");
    }

    @Test
    void usesSeparateBucketsForDifferentClientIps() throws Exception {
        AtomicInteger chainCalls = new AtomicInteger();

        filter.doFilter(request("/api/auth/register", "10.0.0.1"),
                new MockHttpServletResponse(), countingChain(chainCalls));
        filter.doFilter(request("/api/auth/register", "10.0.0.1"),
                new MockHttpServletResponse(), countingChain(chainCalls));
        filter.doFilter(request("/api/auth/register", "10.0.0.2"),
                new MockHttpServletResponse(), countingChain(chainCalls));

        assertThat(chainCalls).hasValue(3);
    }

    @Test
    void usesForwardedClientAddressWhenEnabled() throws Exception {
        AtomicInteger chainCalls = new AtomicInteger();
        MockHttpServletRequest first = request("/api/auth/login", "10.0.0.1");
        first.addHeader("X-Forwarded-For", "203.0.113.10, 10.0.0.1");
        MockHttpServletRequest second = request("/api/auth/login", "10.0.0.1");
        second.addHeader("X-Forwarded-For", "203.0.113.11, 10.0.0.1");

        filter.doFilter(first, new MockHttpServletResponse(), countingChain(chainCalls));
        filter.doFilter(second, new MockHttpServletResponse(), countingChain(chainCalls));

        assertThat(chainCalls).hasValue(2);
    }

    private MockHttpServletRequest request(String path, String remoteAddress) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr(remoteAddress);
        return request;
    }

    private FilterChain countingChain(AtomicInteger chainCalls) {
        return (request, response) -> chainCalls.incrementAndGet();
    }
}
