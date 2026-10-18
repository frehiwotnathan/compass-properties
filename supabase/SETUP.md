# Compass Properties admin setup

The admin uses Supabase Auth, project-scoped tables, row-level security, and the public `compass-media` Storage bucket. The browser uses only the Supabase project URL and publishable/anon key. Never put a `service_role` or secret key in this site.

## 1. Create the database objects

1. Open the existing Supabase project and its SQL Editor.
2. Run [`schema.sql`](./schema.sql). If the database was set up earlier, run it again to add the private contact-message inbox; the existing project and media records are preserved.
3. In Authentication → Users, create or invite the single owner account.
4. In the SQL Editor, replace the sample email in the commented bootstrap statement at the bottom of `schema.sql` with the owner's Auth email, uncomment and run it. This grants that user admin access; no other Auth user is automatically an admin.

The migration creates Compass-prefixed tables and seeds the four projects supplied for this site. Seed inserts do not overwrite existing rows.

## 2. Set the project connection

In [`../js/supabase-config.js`](../js/supabase-config.js), add the Project URL from Project Settings → API. The publishable key is already set. Both values are browser-safe only when the SQL row-level security policies remain enabled.

## 3. Run locally

From the project root, start a local web server:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/admin.html`. `file://` pages are not supported for Supabase Auth/module imports. Sign in with the owner account. If it is not approved, run the bootstrap SQL in step 1.

The public site reads published projects and renderings from Supabase when configured. The contact form stores messages in `compass_contact_messages`; visitors can submit messages, but only an approved Compass admin can read them from the private inbox on `admin.html`. When the URL is not set, the site continues to show the supplied local project information and images, but the contact form cannot submit messages.

## 4. Publish

When deploying, add the production domain to Supabase Authentication → URL Configuration → Redirect URLs, and set the production Site URL. Keep the project's row-level security policies enabled. Test public reads, owner edits, uploads, contact form submissions, owner inbox access, and a non-admin sign-in before sharing the admin URL.
