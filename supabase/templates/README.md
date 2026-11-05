# Supabase auth email templates

VentureLens signs founders in without a password. Every auth email offers two
equivalent ways in, and both come from the same one-time token:

| In the email | Template variable | Handled by |
| --- | --- | --- |
| Button | `{{ .TokenHash }}` | `app/auth/confirm/route.ts` |
| 6-digit code | `{{ .Token }}` | the code step in `components/auth-screen.tsx` |

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
5. Open **Authentication → Providers → Email** and confirm the email OTP length
   is **6** and the expiry is **3600** seconds. The login screen only accepts
   6 digits, and both emails promise a 1-hour expiry.

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

## Known limitation: link scanners

Some corporate mail filters, such as Microsoft Defender Safe Links, open every
link in an email before the person does. A scanner that opens the button link
consumes the token, so the founder's click then fails and the code fails too.
They can request a new email from the login screen. If this shows up in
support requests, change `/auth/confirm` to show a "Continue" button that
submits a form, because scanners do not submit forms.
