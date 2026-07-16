package com.shubham.ink.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class TelemetryControllerTest {

    @Test
    void recordsOnlyAllowedLandingEvents() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        TelemetryController controller = new TelemetryController(registry);

        controller.recordAnalytics(new TelemetryController.AnalyticsEvent("page_view", "/"));
        controller.recordAnalytics(new TelemetryController.AnalyticsEvent("unknown", "/"));

        assertThat(registry.counter("ink.landing.events", "event", "page_view").count()).isEqualTo(1);
        assertThat(registry.find("ink.landing.events").tag("event", "unknown").counter()).isNull();
    }

    @Test
    void recordsSanitizedClientErrors() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        TelemetryController controller = new TelemetryController(registry);

        controller.recordClientError(new TelemetryController.ClientError(
            "Unexpected\nerror",
            "/notes",
            "Test browser"
        ));

        assertThat(registry.counter("ink.client.errors").count()).isEqualTo(1);
    }
}
