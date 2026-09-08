## MODIFIED Requirements

### Requirement: Read-Path Caching
The system SHALL cache product listing results to reduce repeated load
on the underlying data store, and SHALL tolerate a bounded staleness
window between listing reads that have no intervening write. A write to
the product catalog — create, update (including deactivate), or delete —
SHALL invalidate previously cached listings, so the next listing read
after that write reflects it rather than serving a pre-write cached
result.

#### Scenario: Cached listing served within staleness window
- **WHEN** the product listing is requested again with the same
  filters/page shortly after a previous identical request, with no
  product created, updated, or deleted in between
- **THEN** the system may serve a cached result up to a bounded
  staleness window old, without querying the underlying data store

#### Scenario: Listing reflects a create without waiting for the staleness window
- **WHEN** a client creates a product and then requests a listing whose
  filters/page would include that product
- **THEN** the listing returned includes the newly created product,
  regardless of any listing cached before the create

#### Scenario: Listing reflects an update or delete without waiting for the staleness window
- **WHEN** a client updates, deactivates, or deletes a product and then
  requests a listing
- **THEN** the listing returned reflects that change (the product
  appears with its new data, or is absent when it was deactivated or
  deleted), regardless of any listing cached before the write

#### Scenario: Cache does not block reads when unavailable
- **WHEN** the cache is unavailable
- **THEN** the system falls back to reading directly from the underlying
  data store rather than failing the request

#### Scenario: Cache invalidation failure does not fail the write
- **WHEN** a product create, update, or delete succeeds but the cache
  invalidation step cannot reach the cache
- **THEN** the write is still reported as successful, and stale listings
  age out on their own via the bounded staleness window
