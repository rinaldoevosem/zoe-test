# Calendar Feeds are rendered on request, not synced

A Calendar Feed is a secret URL (`/api/calendar/<token>.ics`) that renders the Staff Member's published Assignments at request time; there is no export job and no stored copy. Tokens are random, hashed at rest and revocable. This removes the "my Google/Outlook calendar is days out of date" class of complaint at its root — staleness is bounded only by the calendar client's polling interval — at the cost of a cheap read query per poll.
