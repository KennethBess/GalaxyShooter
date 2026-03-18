## Requirements

### Requirement: DELETE endpoint removes a single leaderboard entry
The server SHALL expose `DELETE /api/leaderboard/:id` that removes the entry with the given ID from both the Redis sorted set and its metadata hash. The endpoint SHALL return HTTP 204 on success and HTTP 404 if the entry does not exist.

#### Scenario: Successfully delete an existing entry
- **WHEN** a client sends `DELETE /api/leaderboard/abc123` and entry `abc123` exists
- **THEN** the server removes the entry from the sorted set and deletes the `leaderboard:entry:abc123` hash
- **AND** responds with HTTP 204 (No Content)

#### Scenario: Delete a non-existent entry
- **WHEN** a client sends `DELETE /api/leaderboard/unknown-id` and no such entry exists
- **THEN** the server responds with HTTP 404 and an error message

#### Scenario: Remaining entries shift rank
- **WHEN** entry at rank 3 is deleted from a leaderboard with 10 entries
- **THEN** subsequent fetches return 9 entries with ranks recalculated (1-9)

---

### Requirement: Client provides per-entry remove action on leaderboard screen
The leaderboard screen SHALL display a remove button on each leaderboard row. Clicking the button SHALL prompt for confirmation before sending the delete request.

#### Scenario: Remove button visible on each entry
- **WHEN** the leaderboard screen renders entries
- **THEN** each row displays a remove button (e.g., "X" icon)

#### Scenario: Confirmation before deletion
- **WHEN** the user clicks the remove button on an entry
- **THEN** a confirmation prompt is shown (e.g., "Remove this score?")

#### Scenario: Confirmed deletion removes entry and refreshes list
- **WHEN** the user confirms the removal
- **THEN** the client sends `DELETE /api/leaderboard/:id`
- **AND** on success, the entry is removed from the displayed list and the leaderboard is re-fetched

#### Scenario: Cancelled deletion keeps entry
- **WHEN** the user cancels the removal confirmation
- **THEN** no request is sent and the entry remains in the list

#### Scenario: Delete request fails
- **WHEN** the delete API call fails (network error or non-204 response)
- **THEN** the entry remains in the list and an error message is shown
