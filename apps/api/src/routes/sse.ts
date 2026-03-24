import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Shared SSE bootstrap so task/session streams use the same headers,
 * heartbeat cadence, and connection teardown semantics.
 */
export function openSse(
  request: FastifyRequest,
  reply: FastifyReply,
  options: {
    eventName: string;
    onSubscribe: (send: (payload: unknown) => void) => Promise<() => void>;
  },
) {
  const originHeader = request.headers.origin;
  const allowOrigin = Array.isArray(originHeader) ? originHeader[0] : originHeader ?? "*";

  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
  });

  const send = (payload: unknown) => {
    reply.raw.write(`event: ${options.eventName}\n`);
    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const heartbeat = setInterval(() => {
    reply.raw.write("event: ping\n");
    reply.raw.write("data: {}\n\n");
  }, 15000);

  void options.onSubscribe(send).then((unsubscribe) => {
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    });
  });
}
