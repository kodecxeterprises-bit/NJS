# NJS Support Desk fixes

This package contains the Support Desk routing and authenticated-layout fixes.

## Changes

- Signed-in users opening `/contact` now see the Support Desk inside the normal NJS `AppLayout`, including the existing sidebar and dashboard navigation.
- Visitors who are not signed in retain the existing public Contact/Support sign-in experience.
- `GET /api/support/tickets` now lists the signed-in user's tickets.
- `POST /api/support/tickets` continues to create a ticket and its opening message.
- `GET /api/support/tickets/:ticketId` now loads a ticket conversation.
- `POST /api/support/tickets/:ticketId/replies` now sends a customer reply.
- Ticket IDs are URL-decoded safely and unsupported collection methods return HTTP 405.

## Deployment note

The Cloudflare Worker must have `SUPABASE_URL` and `SUPABASE_SECRET_KEY` configured. The existing Support Desk database tables and permissions must also be present in Supabase.
