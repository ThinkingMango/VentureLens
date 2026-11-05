# Supabase auth email templates

VentureLens signs founders in without a password. Every auth email offers two
equivalent ways in, and both come from the same one-time token:

| In the email | Template variable | Handled by |
| --- | --- | --- |
| Button | `{{ .TokenHash }}` | `app/auth/confirm/page.tsx` and its confirmation action |
| Provider-issued code (6–10 digits) | `{{ .Token }}` | the code step in `components/auth-screen.tsx` |

Using either one consumes the token, so the other stops working.

## Files

| File | Supabase template | Sent when | Subject |
| --- | --- | --- | --- |
| `magic-link.html` | Magic Link | An existing founder signs in | `Your VentureLens sign-in link` |
| `confirm-signup.html` | Confirm signup | A new founder enters their email for the first time | `Confirm your email for VentureLens` |

Both emails load their logo from `{{ .SiteURL }}/email/logo.png`, which is
`public/email/logo.png` in this repo.

The login screen calls `signInWithOtp` with `shouldCreateUser: true`. When
**Confirm email** is turned on, Supabase sends **Confirm signup** to new
founders who have not confirmed yet and **Magic Link** to everyone else. Both
templates need `{{ .Token }}`, or the code step on the login screen fails for
that group.

## Set it up in the Supabase dashboard

1. Deploy this branch first. Otherwise the button leads to a page that does
   not exist yet.
2. Open **Authentication → URL Configuration** and set **Site URL** to the
   production origin, with no trailing slash. The button link and the logo are
   both built from it.
3. Open **Authentication → Emails → Templates → Magic Link**. Set the subject
   from the table above, paste in `magic-link.html` and save.
4. Open **Confirm signup** on the same page. Set its subject, paste in
   `confirm-signup.html` and save.
5. The login screen and shared verifier accept **6–10 digits**, including
   Supabase's eight-digit codes. Do not shorten provider-issued codes or change
   the provider length just to match the UI. Both email templates promise a
   1-hour expiry, so their copy must match the configured OTP expiry (3600 seconds).

## Local development with the Supabase CLI

If a `supabase/config.toml` is added later, point the templates at these files:

```toml
[auth.email.template.magic_link]
subject = "Your VentureLens sign-in link"
content_path = "./supabase/templates/magic-link.html"

[auth.email.template.confirmation]
subject = "Confirm your email for VentureLens"
content_path = "./supabase/templates/confirm-signup.html"
```

## Link scanners

Some corporate mail filters, such as Microsoft Defender Safe Links, open every
link in an email before the person does. If opening the link signed the
founder in, the scanner would use up the one-time token, and both the button
and the code would then fail.

So opening `/auth/confirm` never signs anyone in. It shows a **Continue**
button, and the token is only checked when the founder submits that form.
Scanners do not submit forms.

- `app/auth/confirm/page.tsx` renders the page. It does not call Supabase.
- `app/auth/confirm/actions.ts` is the Server Action that verifies the token
  and redirects to `/auth/callback`. Next.js rejects Server Action posts from
  other origins, so another site cannot submit the form for the founder.
- The form is rendered on the server, so it also works without JavaScript.
- The page sets a `same-origin` referrer policy through its
  `<meta name="referrer">` tag, so the token in its URL is never sent to
  other sites. Do not change it to `no-referrer`: browsers then
  send `Origin: null` on the form post and Next.js rejects it.
