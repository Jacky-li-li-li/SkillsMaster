import type { AgentEvent } from "./event-types";

export function encodeSSE(event: AgentEvent): string {
  const data = JSON.stringify(event);
  return `data: ${data}\n\n`;
}

export function createSSEStream(): {
  stream: ReadableStream<Uint8Array>;
  writer: {
    write: (event: AgentEvent) => void;
    close: () => void;
    error: (err: Error) => void;
  };
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let isClosed = false;
  let hasErrored = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  return {
    stream,
    writer: {
      write(event: AgentEvent) {
        if (!controller || isClosed || hasErrored) return;
        const encoded = encoder.encode(encodeSSE(event));
        try {
          controller.enqueue(encoded);
        } catch {
          isClosed = true;
        }
      },
      close() {
        if (!controller || isClosed || hasErrored) return;
        isClosed = true;
        try {
          controller.close();
        } catch {
          // no-op: stream already closed
        }
      },
      error(err: Error) {
        if (!controller || isClosed || hasErrored) return;
        hasErrored = true;
        try {
          controller.error(err);
        } catch {
          // no-op: stream already errored/closed
        }
      },
    },
  };
}
