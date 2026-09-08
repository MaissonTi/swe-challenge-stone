## ADDED Requirements

### Requirement: Current User Profile
The system SHALL allow an authenticated user to retrieve their own
profile information (user id, e-mail, and account creation date) via a
protected endpoint, and SHALL reject unauthenticated requests.

#### Scenario: Authenticated user retrieves their own profile
- **WHEN** a client calls the profile endpoint with a valid, non-revoked
  access token
- **THEN** the system returns that token's associated user's `userId`,
  `email`, and `createdAt`, without exposing the password hash

#### Scenario: Unauthenticated profile request rejected
- **WHEN** a client calls the profile endpoint without a valid access
  token
- **THEN** the system rejects the request with an authentication error
