function respond(response, status, body) {
  if (response.destroyed) return;
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export function createInputHeadroomHandler(waitForInputHeadroom) {
  let pending = null;
  return {
    async handle(request, response) {
      if (request.method !== "POST" || request.url !== "/input-headroom")
        return false;
      if (pending) {
        respond(response, 409, {
          ready: false,
          error: "Host sample already pending",
        });
        return true;
      }
      const controller = new AbortController();
      pending = controller;
      const abort = () => controller.abort();
      response.once("close", abort);
      try {
        await waitForInputHeadroom({ signal: controller.signal });
        controller.signal.throwIfAborted();
        respond(response, 200, { ready: true });
      } catch (error) {
        respond(response, 503, {
          ready: false,
          error: String(error?.message ?? error),
        });
      } finally {
        response.off("close", abort);
        if (pending === controller) pending = null;
      }
      return true;
    },
    stop() {
      pending?.abort();
    },
  };
}
