# web-spa Specification

## Purpose

Provides a browser-based single-page application through which a human
user can sign up, sign in, browse and manage the product catalog, and
view their own profile, using the existing authentication and products
API as its only backend.

## Requirements

### Requirement: Protected Route Access
The application SHALL restrict access to authenticated-only views (product
catalog, profile) to users holding a valid session, redirecting
unauthenticated users to the sign-in view.

#### Scenario: Unauthenticated visitor redirected to sign-in
- **WHEN** a visitor without an active session navigates directly to an
  authenticated-only route
- **THEN** the application redirects them to the sign-in view instead of
  rendering the requested view

#### Scenario: Authenticated user reaches the requested route
- **WHEN** a user with an active session navigates to an
  authenticated-only route
- **THEN** the application renders the requested view without an
  additional login prompt

### Requirement: Sign Up
The application SHALL provide a sign-up form that submits to the
registration endpoint and enforces the same password policy as the API
before submission.

#### Scenario: Password violating policy blocked before submission
- **WHEN** a user enters a password that does not meet the minimum
  length or character composition rules
- **THEN** the application shows a validation error and does not submit
  the form

#### Scenario: Successful registration redirects to sign-in
- **WHEN** a user submits a valid, unused e-mail and a policy-compliant
  password
- **THEN** the application shows a success indication and directs the
  user to sign in

### Requirement: Sign In
The application SHALL provide a sign-in form that authenticates against
the login endpoint and establishes a client-side session on success.

#### Scenario: Successful sign-in establishes a session
- **WHEN** a user submits a valid e-mail and matching password
- **THEN** the application stores the issued tokens, establishes an
  authenticated session, and navigates to the product catalog

#### Scenario: Invalid credentials show a generic error
- **WHEN** a user submits an e-mail/password combination the API rejects
- **THEN** the application shows a generic authentication error without
  indicating whether the e-mail exists

### Requirement: Session Token Handling
The application SHALL hold the access token only in memory for the
lifetime of the running application, SHALL persist the refresh token in
browser `localStorage`, and SHALL transparently refresh an expired
session on a request that fails with an authentication error.

#### Scenario: Access token not persisted across a reload
- **WHEN** the user reloads the page or reopens the application in a new
  tab
- **THEN** the previously held access token is gone from memory, and the
  application uses the stored refresh token to obtain a new session
  before rendering authenticated content

#### Scenario: Expired access token triggers a silent refresh and retry
- **WHEN** a request to the API fails because the access token has
  expired
- **THEN** the application uses the stored refresh token to obtain a new
  token pair and retries the original request once, transparently to the
  user

#### Scenario: Refresh failure ends the session
- **WHEN** the stored refresh token is rejected by the API (expired,
  revoked, or reuse detected)
- **THEN** the application clears the stored session and redirects the
  user to sign in

### Requirement: Sign Out
The application SHALL allow an authenticated user to sign out, which
calls the API's logout endpoint and clears the local session regardless
of whether that call succeeds.

#### Scenario: Sign-out clears local session
- **WHEN** an authenticated user triggers sign-out
- **THEN** the application calls the logout endpoint, discards the
  in-memory access token and the stored refresh token, and redirects to
  sign-in

### Requirement: Product Catalog Listing
The application SHALL display the product catalog as a paginated,
filterable list backed by the products listing endpoint, reflecting the
same filters (category, name prefix) and pagination model (opaque
cursor) the API exposes.

#### Scenario: Listing loads the first page by default
- **WHEN** an authenticated user opens the product catalog view without
  prior filters
- **THEN** the application requests and displays the first page of
  active products

#### Scenario: Filter selection re-queries the listing
- **WHEN** a user selects a category or enters a name prefix filter
- **THEN** the application re-queries the listing endpoint with the
  selected filters and displays the matching results

#### Scenario: Navigating to the next page uses the returned cursor
- **WHEN** a user requests the next page from a listing that included a
  pagination cursor
- **THEN** the application requests the next page using that cursor and
  appends or replaces the displayed results accordingly

### Requirement: Product Management
The application SHALL allow an authenticated user to create, update,
deactivate, and delete a product through forms backed by the
corresponding API operations, validating input client-side against the
same rules the API enforces (including a valid category).

#### Scenario: Creating a product with an invalid category is blocked client-side
- **WHEN** a user submits the product creation form with a category
  value outside the fixed set
- **THEN** the application shows a validation error and does not submit
  the request

#### Scenario: Successful creation reflects in the listing
- **WHEN** a user submits a valid product creation form
- **THEN** the application creates the product via the API and the new
  product becomes visible in the catalog listing

#### Scenario: Deactivating a product removes it from the default listing view
- **WHEN** a user deactivates a product from the catalog view
- **THEN** the application calls the update endpoint to set it inactive,
  and the product no longer appears in the default listing after the
  view refreshes

#### Scenario: Deleting a product removes it permanently
- **WHEN** a user deletes a product from the catalog view
- **THEN** the application calls the delete endpoint and the product no
  longer appears in the catalog after the view refreshes

### Requirement: Profile View
The application SHALL provide a profile view that displays the
authenticated user's own account information retrieved from the API.

#### Scenario: Profile view displays the current user's data
- **WHEN** an authenticated user opens the profile view
- **THEN** the application retrieves and displays that user's e-mail and
  account creation date
