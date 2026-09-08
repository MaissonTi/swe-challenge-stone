# Rate-limit: sliding window counter

Full rationale (why sliding window, why in the application instead of
delegated to AWS WAF) in [`docs/PRD.md`, §4.3](../PRD.md).

## The guard's decision, per request

```mermaid
flowchart TD
    A["Request arrives at the route"] --> B["Resolves limit:<br/>route's @RateLimit or default (100/60s)"]
    B --> C{"request.user exists?<br/>(authenticated route)"}
    C -- yes --> D["identity = user:&lt;userId&gt;"]
    C -- no --> E["identity = ip:&lt;ip&gt;"]
    D --> F["key = Controller:handler:identity"]
    E --> F
    F --> G["RedisRateLimiter.consume(key, limit, window)"]
    G --> H{"Redis available?"}
    H -- no --> I["fail-open: allowed = true"]
    H -- yes --> J["Lua: INCR current window<br/>+ weight of previous window"]
    J --> K{"estimate > limit?"}
    K -- yes --> L["429 Too Many Requests<br/>+ Retry-After"]
    K -- no --> M["Allows the request"]
    I --> M
```

## The calculation (sliding window via two fixed windows)

```mermaid
flowchart LR
    subgraph Prev["Previous window"]
        P["counter: 80 requests"]
    end
    subgraph Curr["Current window"]
        Q["counter: 20 requests<br/>40% of the window elapsed"]
    end
    P -->|"weight = 1 − 0.4 = 0.6"| R["80 × 0.6 = 48"]
    Q --> S["+ 20"]
    R --> T["estimate = 68"]
    S --> T
    T --> U{"68 > limit (e.g. 100)?"}
    U -- no --> V["Allow"]
    U -- yes --> W["Block 429"]
```

**Why not a fixed window:** a counter that resets abruptly allows up
to 2x the limit by concentrating requests around the reset. The
sliding window carries weight from the previous window, closing that
gap — the same behavior as an AWS WAF rate-based rule, without
delegating execution to it.
