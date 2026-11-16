# Shifts are stored as local date + local wall-clock minutes

A Shift is stored as `date` (YYYY-MM-DD) plus `startMinute`/`endMinute` (minutes after local midnight; end may exceed 1440 for overnight) in its Department's IANA time zone. Instants are derived only at the edges (Calendar Feed, Who's On Call, Time Entries). Clinicians think in "the 07:00 shift on March 9", and storing UTC instants makes the DST-change night silently shift by an hour — a known source of wrong call schedules. Rest-period Rules compute on derived instants so a 23-hour or 25-hour DST night is measured correctly.
