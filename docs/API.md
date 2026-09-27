# API reference

All workspace endpoints require a Supabase session cookie. Mutations require an `Origin` matching `NEXT_PUBLIC_APP_URL` and validated JSON. Errors return `{ "error": "message" }` with 400/401/403/404/409/413/429/500 status. Secrets never appear in responses. List endpoints accept `page` (1-based), `size` (1–100) and return `{ items, count }` unless stated otherwise. Date/times use ISO 8601.

| Endpoint                                             | Methods                  | Purpose                                                                                                                                |
| ---------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/imports`                                       | GET, POST                | List/import processed recipients. POST accepts `{summary,recipients}` from the spreadsheet pipeline.                                   |
| `/api/imports/:id`                                   | GET                      | Import summary and paginated recipient provenance.                                                                                     |
| `/api/contacts`                                      | GET, POST, PATCH, DELETE | Search with `search`, `status`, `sort`, `group`, `import`; add `{email,name,group_id?}`; bulk status `{ids,status}` or delete `{ids}`. |
| `/api/contacts/:id`                                  | GET, PATCH               | Detail and history; update name/status.                                                                                                |
| `/api/contacts/export`                               | POST                     | `{ids}` → escaped CSV download.                                                                                                        |
| `/api/contacts/groups`                               | GET, POST                | Groups (up to 100); create `{name,color}`.                                                                                             |
| `/api/contacts/groups/:id`                           | DELETE                   | Remove group.                                                                                                                          |
| `/api/contacts/groups/:id/members`                   | POST                     | Add `{ids}` contacts.                                                                                                                  |
| `/api/templates`                                     | GET, POST                | Filter by `search`, `category`; create template.                                                                                       |
| `/api/templates/:id`                                 | GET, PATCH, DELETE       | Template CRUD.                                                                                                                         |
| `/api/templates/seed`                                | POST                     | Add starter templates to an existing user.                                                                                             |
| `/api/campaigns`                                     | GET, POST                | Filter by `status`, `search`; save draft.                                                                                              |
| `/api/campaigns/:id`                                 | GET, PATCH, DELETE       | Read/edit draft/delete finished or draft campaign.                                                                                     |
| `/api/campaigns/:id/recipients`                      | GET                      | Paginated saved recipient IDs.                                                                                                         |
| `/api/campaigns/:id/send`                            | POST                     | Enqueue; optional `{scheduled_at}` schedules future delivery. 10 requests/hour.                                                        |
| `/api/campaigns/:id/test`                            | POST                     | Send to authenticated user's email. 10 requests/hour.                                                                                  |
| `/api/campaigns/:id/status`                          | GET                      | Campaign and queue counts.                                                                                                             |
| `/api/campaigns/:id/deliveries`                      | GET                      | Paginated report with `search`, `status`.                                                                                              |
| `/api/campaigns/:id/duplicate`                       | POST                     | Copy content and recipients to a draft.                                                                                                |
| `/api/campaigns/:id/pause`, `/resume`                | POST                     | Control future processing.                                                                                                             |
| `/api/attachments`                                   | POST                     | Multipart `file`, private storage, returns attachment metadata.                                                                        |
| `/api/analytics/overview`, `/timeline`, `/campaigns` | GET                      | Aggregated reports, `days=7/30/90/0`.                                                                                                  |
| `/api/settings`                                      | GET, PATCH               | Profile, preferences and encrypted provider/webhook keys.                                                                              |
| `/api/settings/senders`                              | GET, POST                | List/create sender identities.                                                                                                         |
| `/api/settings/senders/:id`                          | POST, PATCH, DELETE      | Verify with provider, make default, delete.                                                                                            |
| `/api/automations`                                   | GET, POST                | List/create draft workflow with steps.                                                                                                 |
| `/api/automations/:id`                               | GET, PATCH, DELETE       | Read/edit draft/delete inactive workflow.                                                                                              |
| `/api/automations/:id/activate`, `/pause`            | POST                     | Control workflow.                                                                                                                      |
| `/api/automations/:id/enroll`                        | POST                     | Manual `{ids}` enrollment; unique per contact/workflow.                                                                                |
| `/api/automations/:id/enrollments`                   | GET                      | Paginated enrollment state/errors.                                                                                                     |
| `/api/jobs`                                          | GET                      | Worker; requires `Authorization: Bearer CRON_SECRET`.                                                                                  |
| `/api/webhooks/resend?user=:uuid`                    | POST                     | Raw signed Resend payload; no cookie/origin requirement.                                                                               |

Schemas are defined in `lib/server/schemas.ts`. Campaign drafts contain `name,subject,from_name,reply_to,body_html,body_text,sender_id,contact_ids,attachments`. HTML is sanitized server-side. An attachment path must belong to the authenticated user, exist in private storage, and match its declared size. No direct public download URLs are accepted.

All mutations share a persistent hourly limit of 1,000; sends and tests each have a separate limit of 10. Uploads have a limit of 100/hour. Quotas are an MVP operational safeguard, not a billing system.

Attachment uploads can also use POST /api/attachments/sign with {filename,size}. It returns a scoped Supabase upload token and metadata for a direct storage upload, avoiding hosting request-body limits. Campaign creation validates the stored file before accepting it.
