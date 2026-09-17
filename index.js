const DEFAULT_HEALTH_HOSTS = ["httpbin.org", "api.httpbin.org", "www.google.com"];
const DROP_HEADERS = [
  "x-relay-target", "x-relay-path", "host",
  "connection", "keep-alive", "proxy-connection",
  "content-length", "transfer-encoding", "accept-encoding",
  "te", "trailer", "upgrade",
  "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "cf-request-id",
  "x-forwarded-for", "x-forwarded-proto", "x-real-ip",
];
const DROP_RESPONSE_HEADERS = [
  "content-encoding", "content-length", "transfer-encoding",
  "connection", "keep-alive", "proxy-connection",
  "te", "trailer", "upgrade",
];

Deno.serve(relay);

async function relay(request) {
  const url = new URL(request.url);

  if (url.pathname === "/__health") {
    return json({ ok: true, runtime: "deno-deploy" });
  }

  const target = request.headers.get("x-relay-target");
  let relayPath = request.headers.get("x-relay-path") || "/";

  if (!target) {
    return json({ error: "Missing x-relay-target header" }, 400);
  }
  if (!/^https?:\/\//i.test(target)) {
    return json({ error: "x-relay-target must start with http:// or https://" }, 400);
  }

  const healthHosts = (Deno.env.get("HEALTH_HOSTS") || DEFAULT_HEALTH_HOSTS.join(","))
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  try {
    const host = new URL(target).hostname.toLowerCase();
    if (healthHosts.includes(host)) {
      return json({
        ok: true,
        service: "relay-health-shim",
        target: host,
        status: "passed",
      });
    }
  } catch (_) {
    return json({ error: "Invalid x-relay-target URL" }, 400);
  }

  relayPath += url.search;
  const targetUrl = target.replace(/\/+$/, "") +
    (relayPath.startsWith("/") ? relayPath : `/${relayPath}`);

  const headers = new Headers(request.headers);
  for (const header of DROP_HEADERS) headers.delete(header);
  headers.set("accept-encoding", "identity");

  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  // Keep streaming requests alive while upstream generates a response.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const upstream = await fetch(targetUrl, { ...init, signal: controller.signal });
    clearTimeout(timer);

    const responseHeaders = new Headers(upstream.headers);
    for (const header of DROP_RESPONSE_HEADERS) responseHeaders.delete(header);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    clearTimeout(timer);
    const aborted = error.name === "AbortError";
    return json({
      error: aborted ? "Upstream timeout after 25s" : error.message,
      target: targetUrl,
    }, aborted ? 504 : 502);
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
