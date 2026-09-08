## MODIFIED Requirements

### Requirement: Password Policy

The system SHALL require passwords to be at least 8 characters long,
contain at least one uppercase letter, one lowercase letter, and one
number, and SHALL NOT contain any whitespace character.

#### Scenario: Password rejected for not meeting policy

- **WHEN** a client attempts to register or change a password that does
  not meet the minimum length or character composition rules
- **THEN** the system rejects the request with a validation error
  describing the unmet rule(s)

#### Scenario: Password rejected for containing whitespace

- **WHEN** a client attempts to register or change a password that
  contains a space or any other whitespace character, even if it
  otherwise meets the length and composition rules
- **THEN** the system rejects the request with a validation error
