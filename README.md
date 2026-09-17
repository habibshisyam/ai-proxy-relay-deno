# AI Proxy Relay — Deno Deploy

Stateless header relay untuk 9Router / VansRouter.

## Deploy

1. Buka Deno Deploy.
2. Import repo ini dari GitHub.
3. Pilih entrypoint `index.js`.
4. Deploy.

`HEALTH_HOSTS` optional. Default:

```text
httpbin.org,api.httpbin.org,www.google.com
```

## Pasang di 9Router

Gunakan URL origin-only:

```text
https://<project>.deno.dev
```

Set pool `type` sebagai `deno`. Jangan gunakan `type: http`.

## Test

```bash
curl -i "https://<project>.deno.dev/" -H "x-relay-target: https://httpbin.org" -H "x-relay-path: /get"
curl -i "https://<project>.deno.dev/" -H "x-relay-target: https://api.deepseek.com" -H "x-relay-path: /v1/models"
```

Health shim `200` berarti lulus. `401` dari DeepSeek berarti relay tembus dan provider meminta API key.
