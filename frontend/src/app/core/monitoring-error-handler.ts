import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class MonitoringErrorHandler implements ErrorHandler {
  handleError(error: unknown) {
    console.error(error);
    const candidate = error instanceof Error ? error : new Error(String(error));
    const body = JSON.stringify({
      message: candidate.message.slice(0, 500),
      path: location.pathname,
      userAgent: navigator.userAgent.slice(0, 180),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/public/client-errors', new Blob([body], { type: 'application/json' }));
      return;
    }

    void fetch('/api/public/client-errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    });
  }
}
