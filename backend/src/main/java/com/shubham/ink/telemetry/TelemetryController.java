package com.shubham.ink.telemetry;

import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.micrometer.core.instrument.MeterRegistry;

@RestController
@RequestMapping("/api/public")
public class TelemetryController {

    private static final Logger log = LoggerFactory.getLogger(TelemetryController.class);
    private static final Set<String> ALLOWED_EVENTS = Set.of("page_view", "register_click", "login_click");
    private final MeterRegistry meterRegistry;

    public TelemetryController(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @PostMapping("/analytics")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordAnalytics(@RequestBody AnalyticsEvent payload) {
        if (payload == null || !ALLOWED_EVENTS.contains(payload.event())) {
            return;
        }

        String path = sanitize(payload.path(), 120);
        meterRegistry.counter("ink.landing.events", "event", payload.event()).increment();
        log.info("landing_event event={} path={}", payload.event(), path);
    }

    @PostMapping("/client-errors")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void recordClientError(@RequestBody ClientError payload) {
        if (payload == null) {
            return;
        }

        meterRegistry.counter("ink.client.errors").increment();
        log.error(
            "client_error path={} message={} user_agent={}",
            sanitize(payload.path(), 120),
            sanitize(payload.message(), 500),
            sanitize(payload.userAgent(), 180)
        );
    }

    private String sanitize(String value, int maxLength) {
        if (value == null) {
            return "unknown";
        }
        String cleaned = value.replaceAll("[\\r\\n\\t]", " ");
        return cleaned.substring(0, Math.min(cleaned.length(), maxLength));
    }

    public record AnalyticsEvent(String event, String path) {}

    public record ClientError(String message, String path, String userAgent) {}
}
