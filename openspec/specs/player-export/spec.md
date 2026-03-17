## Purpose

Admin CSV export of registered player data for event management and marketing.

## Requirements

### Requirement: CSV export endpoint
The server SHALL expose a `GET /players/export` endpoint that returns all registered players as a CSV file download.

#### Scenario: Successful CSV export
- **WHEN** an admin requests `GET /players/export`
- **THEN** the server responds with a `text/csv` content type, `Content-Disposition: attachment; filename="players.csv"` header, and a CSV body containing columns: Full Name, Email, Phone, Registered At

#### Scenario: No registered players
- **WHEN** an admin requests `GET /players/export` and no players exist
- **THEN** the server responds with a CSV containing only the header row

### Requirement: CSV format
The CSV output SHALL use comma-separated values with a header row. Fields containing commas or quotes MUST be properly escaped per RFC 4180. The registeredAt timestamp MUST be formatted as ISO 8601.

#### Scenario: Field with special characters
- **WHEN** a player's full name contains a comma (e.g., "Smith, Jane")
- **THEN** the field is enclosed in double quotes in the CSV output

#### Scenario: Timestamp formatting
- **WHEN** a registration is exported
- **THEN** the registeredAt field is in ISO 8601 format (e.g., `2026-03-17T14:30:00.000Z`)
