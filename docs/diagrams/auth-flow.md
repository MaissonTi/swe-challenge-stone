# Authentication flow

Register → login → refresh with rotation → reuse detection/cascading
revocation → logout — full rationale in
[`docs/PRD.md`, §4.6](../PRD.md).

```mermaid
flowchart TD
    Reg["POST /v1/auth/register<br/>argon2id hash, always 204"] --> Login
    Login["POST /v1/auth/login"] --> D1{"Valid credentials?"}
    D1 -- no --> R401["401 (generic message)"]
    D1 -- yes --> Issue["Issues access token (15 min)<br/>+ refresh token (7 days, sliding)"]
    Issue --> Refresh["POST /v1/auth/refresh<br/>(refresh token)"]
    Refresh --> D2{"Was the refresh<br/>already used before?"}
    D2 -- no --> Rotate["Blacklists the old token,<br/>issues a new pair (same family)"]
    D2 -- yes --> Theft["YES → theft signal:<br/>revokes the WHOLE token family<br/>(not just denying 1 request)"]
    Rotate -.-> Refresh
    Issue -.-> Logout
    Logout["POST /v1/auth/logout<br/>(access token)<br/>Blacklists access + current refresh"]
```

> The "Valid credentials?" diamond covers the two cases `LoginUseCase`
> treats identically — a nonexistent user and a wrong password — always
> with the same generic `401`, so as not to leak whether an e-mail
> exists in the database (enumeration protection, see `docs/PRD.md`
> §4.6).

## Redis blacklist checks, scenario by scenario

```mermaid
sequenceDiagram
    actor Client
    participant Guard as JwtAuthGuard
    participant Strategy as JwtStrategy
    participant RTS as RedisTokenRevocationStore
    participant Redis
    participant LogoutUC as LogoutUseCase
    participant RefreshUC as RefreshTokenUseCase

    Note over Client,Redis: Scenario 1 — Authenticated request
    Client->>Guard: GET /v1/products (Bearer access token)
    Guard->>Strategy: validate(payload)
    Strategy->>Strategy: verifies RS256 signature
    Strategy->>RTS: isRevoked(jti, familyId)
    RTS->>Redis: EXISTS blacklist:jti / blacklist:family:familyId
    Redis-->>RTS: 0, 0 (nothing revoked)
    RTS-->>Strategy: false
    Strategy-->>Guard: payload validated
    Guard-->>Client: 200 OK

    Note over Client,Redis: Scenario 2 — Logout
    Client->>LogoutUC: POST /v1/auth/logout (access + refresh)
    LogoutUC->>RTS: blacklistToken(access.jti, ttl)
    RTS->>Redis: SET blacklist:jti EX ttl
    LogoutUC->>RTS: blacklistToken(refresh.jti, ttl)
    RTS->>Redis: SET blacklist:jti EX ttl
    LogoutUC-->>Client: 204 No Content

    Note over Client,Redis: Scenario 3 — Normal refresh (rotation)
    Client->>RefreshUC: POST /v1/auth/refresh (refresh token A)
    RefreshUC->>RTS: isTokenBlacklisted(A.jti)
    RTS->>Redis: EXISTS blacklist:A.jti
    Redis-->>RTS: 0
    RTS-->>RefreshUC: false
    RefreshUC->>RTS: blacklistToken(A.jti, remaining ttl)
    RTS->>Redis: SET blacklist:A.jti EX ttl
    RefreshUC-->>Client: new access + refresh (token B)

    Note over Client,Redis: Scenario 4 — Reuse of token A (theft)
    Client->>RefreshUC: POST /v1/auth/refresh (refresh token A, already used)
    RefreshUC->>RTS: isTokenBlacklisted(A.jti)
    RTS->>Redis: EXISTS blacklist:A.jti
    Redis-->>RTS: 1
    RTS-->>RefreshUC: true (reuse detected)
    RefreshUC->>RTS: blacklistFamily(familyId, ttl)
    RTS->>Redis: SET blacklist:family:familyId EX ttl
    RefreshUC-->>Client: 401 Refresh token reuse detected
```
