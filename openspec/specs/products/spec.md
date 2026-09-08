# products Specification

## Purpose

Provides an authenticated, paginated product catalog with filtering,
ordering, and full lifecycle management (create, update, deactivate,
delete), protecting the underlying data store from expensive repeated
reads.

## Requirements

### Requirement: Protected Product Listing
The system SHALL require a valid, non-revoked access token to list
products, and SHALL reject unauthenticated requests.

#### Scenario: Unauthenticated listing request rejected
- **WHEN** a client requests the product listing without a valid access
  token
- **THEN** the system rejects the request with an authentication error
  and returns no product data

### Requirement: Paginated Listing
The system SHALL return product listings in pages, using an opaque
cursor for navigating to subsequent pages, and SHALL NOT expose internal
data-store keys in the cursor.

#### Scenario: First page returned without a cursor
- **WHEN** an authenticated client requests the product listing without
  providing a cursor
- **THEN** the system returns the first page of active products and, if
  more results exist, an opaque cursor token to retrieve the next page

#### Scenario: Subsequent page returned using a cursor
- **WHEN** an authenticated client requests the product listing with a
  cursor returned from a previous page
- **THEN** the system returns the next page of results continuing from
  where the previous page ended

### Requirement: Stable Ordering
The system SHALL return product listings in a stable, deterministic
order across pages, using a tiebreaker for items with equal sort value.

#### Scenario: Same query returns consistent order across pages
- **WHEN** a client pages through the full listing for a given set of
  filters without any writes occurring in between
- **THEN** every item appears exactly once, in the same relative order,
  across all pages

### Requirement: Only Active Products Listed
The system SHALL exclude deactivated products from the listing by
default.

#### Scenario: Deactivated product excluded from listing
- **WHEN** a product has been deactivated (`active = false`)
- **THEN** it does not appear in the product listing results

### Requirement: Filter by Category
The system SHALL allow filtering the product listing by category, where
category is one of a fixed, predefined set of values.

#### Scenario: Listing filtered by a valid category
- **WHEN** a client requests the product listing with a category filter
  matching a defined category value
- **THEN** the system returns only active products belonging to that
  category

#### Scenario: Listing rejects an undefined category value
- **WHEN** a client requests the product listing with a category filter
  value that is not one of the defined categories
- **THEN** the system rejects the request with a validation error

### Requirement: Filter by Name Prefix
The system SHALL allow filtering the product listing by a
case-insensitive prefix match on the product name, and filters by name
and category SHALL be combinable.

#### Scenario: Listing filtered by name prefix
- **WHEN** a client requests the product listing with a name filter value
- **THEN** the system returns only active products whose name starts
  with that value, regardless of letter case

#### Scenario: Name and category filters combined
- **WHEN** a client requests the product listing with both a name prefix
  filter and a category filter
- **THEN** the system returns only active products that satisfy both
  filters simultaneously

### Requirement: Create Product
The system SHALL allow any authenticated user to create a new product
with the minimum required fields, including a category from the fixed
set of values.

#### Scenario: Successful product creation
- **WHEN** an authenticated client submits a valid product payload with a
  defined category
- **THEN** the system creates the product, marks it active by default,
  and returns the created product

#### Scenario: Creation rejects invalid category
- **WHEN** an authenticated client submits a product payload with a
  category value outside the fixed set
- **THEN** the system rejects the request with a validation error

### Requirement: Update Product
The system SHALL allow any authenticated user to update an existing
product's fields, including toggling its active status.

#### Scenario: Successful product update
- **WHEN** an authenticated client submits valid changes to an existing
  product
- **THEN** the system updates the product and returns the updated
  representation

### Requirement: Deactivate Product
The system SHALL support deactivating a product (setting `active =
false`) as a distinct operation from deletion, without removing it from
storage.

#### Scenario: Deactivated product remains in storage
- **WHEN** an authenticated client deactivates a product via update
- **THEN** the product record remains in the data store (preserving any
  historical references to it) but no longer appears in the default
  listing

### Requirement: Delete Product
The system SHALL allow any authenticated user to permanently delete a
product, physically removing it from storage regardless of its active
status.

#### Scenario: Deleted product is physically removed
- **WHEN** an authenticated client deletes an existing product
- **THEN** the product record is permanently removed from the data store
  and no longer retrievable by its identifier

### Requirement: No Role-Based Authorization on Product Operations
The system SHALL NOT restrict product create, update, deactivate, or
delete operations by user role — any authenticated user SHALL be
permitted to perform any of these operations.

#### Scenario: Any authenticated user can modify any product
- **WHEN** any authenticated user attempts to create, update, deactivate,
  or delete any product, including one they did not create
- **THEN** the system permits the operation, since the system has no
  per-user or role-based product ownership

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
