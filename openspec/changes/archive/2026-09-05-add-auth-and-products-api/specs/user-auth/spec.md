## Purpose

Provides secure user registration and authentication, issuing and
revoking JSON Web Tokens so that only authenticated users can access
protected resources elsewhere in the system.

## ADDED Requirements

### Requirement: User Registration
The system SHALL allow a new user to register with an e-mail and a
password that meets the password policy, and SHALL also support seeding
users for development/demo environments.

#### Scenario: Successful registration
- **WHEN** a client submits a valid, unused e-mail and a password meeting
  the password policy to the registration endpoint
- **THEN** the system creates a new user record with a hashed password
  and responds with success, without returning the password or its hash

#### Scenario: Registration with existing email does not leak existence
- **WHEN** a client submits a registration request with an e-mail that
  already exists in the system
- **THEN** the system responds with a generic error that does not reveal
  whether the e-mail is already registered

### Requirement: Password Policy
The system SHALL require passwords to be at least 8 characters long and
contain at least one uppercase letter, one lowercase letter, and one
number.

#### Scenario: Password rejected for not meeting policy
- **WHEN** a client attempts to register or change a password that does
  not meet the minimum length or character composition rules
- **THEN** the system rejects the request with a validation error
  describing the unmet rule(s)

### Requirement: Password Storage
The system SHALL store passwords only as `argon2id` hashes, never in
plain text or reversibly encrypted form.

#### Scenario: Password hash uses defined cost parameters
- **WHEN** a password is hashed for storage
- **THEN** the system uses `argon2id` with memory cost 19456 KiB, time
  cost 2, and parallelism 1

### Requirement: Login
The system SHALL authenticate a user by e-mail and password and, on
success, issue an access token and a refresh token.

#### Scenario: Successful login
- **WHEN** a client submits a valid e-mail and matching password
- **THEN** the system issues an access token (JWT, RS256, 15 minute
  expiry) and a refresh token (JWT, RS256, 7 day sliding expiry), each
  carrying the user's `sub`/`user_id` as a claim

#### Scenario: Login failure does not reveal whether the email exists
- **WHEN** a client submits an e-mail that does not exist, or a valid
  e-mail with an incorrect password
- **THEN** the system responds with the same generic error message and
  comparable response time in both cases

### Requirement: Token Claims and Signing
Issued tokens SHALL be signed with an RS256 key pair and SHALL NOT carry
role or permission claims, since the system has no authorization levels.

#### Scenario: Token can be verified with the public key alone
- **WHEN** a downstream consumer needs to verify an access token
- **THEN** verification succeeds using only the public key, without
  contacting the token issuer

### Requirement: Access Token Expiry
Access tokens SHALL expire 15 minutes after issuance and SHALL be
rejected by protected routes once expired, independent of any other
revocation mechanism.

#### Scenario: Expired access token is rejected
- **WHEN** a client calls a protected route with an access token whose
  expiry timestamp has passed
- **THEN** the system rejects the request with an authentication error,
  even if the token was never explicitly revoked

### Requirement: Refresh Token Rotation
Each use of a refresh token SHALL invalidate that refresh token and issue
a new access/refresh token pair; a refresh token SHALL be usable at most
once.

#### Scenario: Refresh token rotates on use
- **WHEN** a client presents a valid, not-yet-used refresh token to the
  refresh endpoint
- **THEN** the system issues a new access token and a new refresh token,
  and marks the presented refresh token as no longer usable

#### Scenario: Active session does not expire under continued use
- **WHEN** a user refreshes their session at least once within any 7-day
  window
- **THEN** the refresh token's validity window extends, and the user is
  not required to log in again

### Requirement: Refresh Token Reuse Detection
If a refresh token that has already been used (or explicitly revoked) is
presented again, the system SHALL treat this as a signal of token theft
and revoke every token issued from that same login session.

#### Scenario: Reused refresh token triggers cascading revocation
- **WHEN** a client presents a refresh token that was already rotated out
  (already used once before)
- **THEN** the system rejects the request, and revokes the access token
  and every refresh token descended from that login, requiring the user
  to log in again

### Requirement: Logout and Token Revocation
The system SHALL allow a logged-in user to log out, which immediately
revokes their current access token and refresh token.

#### Scenario: Logout revokes current tokens immediately
- **WHEN** an authenticated user calls the logout endpoint with a valid
  access token
- **THEN** the system revokes that access token and its associated
  refresh token, and subsequent requests using either token are rejected
  even though they have not yet naturally expired

### Requirement: Revocation Check on Protected Routes
Every protected route SHALL verify both the token's signature/expiry and
that the token has not been revoked.

#### Scenario: Revoked token rejected despite valid signature
- **WHEN** a client calls a protected route with an access token that has
  a valid signature and has not expired, but was revoked via logout or
  reuse detection
- **THEN** the system rejects the request with an authentication error

### Requirement: Resilience to Revocation-Store Unavailability
If the underlying revocation store is unavailable, the system SHALL fail
open on the revocation check (allow the request through if the token is
otherwise valid) rather than reject all requests, and SHALL log the
degraded condition.

#### Scenario: Revocation store unavailable does not block valid tokens
- **WHEN** the revocation store cannot be reached within a short timeout
- **THEN** the system allows the request to proceed based on token
  signature and expiry alone, and logs a warning about the degraded state
