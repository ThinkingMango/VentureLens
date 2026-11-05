# Supabase auth email templates

VentureLens signs founders in without a password. Each sign-in email offers two
equivalent ways in, and both come from the same one-time token:

| In the email | Template variable | Handled by |
| --- | --- | --- |
| "Sign in to VentureLens" button | `{{ .TokenHash }}` | `app/auth/confirm/route.ts` |
| 6-digit code | `{{ .Token }}` | the code step in `components/auth-screen.tsx` |

Using either one consumes the token, so the other stops working.

## Files

- `magic-link.html` is the sign-in email for existing users.
- `public/email/sign-in.png` is the logo the email loads from `{{ .SiteURL }}/email/sign-in.png`.

## Set it up in the Supabase dashboard

1. Open **Authentication → URL Configuration** and set **Site URL** to the
   production origin, with no trailing slash. The button link and the logo are
   both built from it.
2. Open **Authentication → Emails → Templates → Magic Link**.
3. Set the subject to `Your VentureLens sign-in link`.
4. Paste the contents of `magic-link.html` into the message body and save.
5. Open **Authentication → Providers → Email** and confirm the email OTP length
   is **6** and the expiry is **3600** seconds. The login screen only accepts
   6 digits, and the email promises a 1-hour expiry.

## New users get a different template

`signInWithOtp` is called with `shouldCreateUser: true`. When **Confirm email**
is turned on, Supabase sends the **Magic Link** template to existing users but
the **Confirm signup** template to brand-new users who have not confirmed yet. If that template still uses the default
`{{ .ConfirmationURL }}` body, new users get no code and the code step on the
login screen cannot work for them. Give **Confirm signup** a body that also
includes `{{ .Token }}` and links to
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

## Local development with the Supabase CLI

If a `supabase/config.toml` is added later, point the template at this file:

```toml
[auth.email.template.magic_link]
subject = "Your VentureLens sign-in link"
content_path = "./supabase/templates/magic-link.html"
```

## Known limitation: link scanners

Some corporate mail filters, such as Microsoft Defender Safe Links, open every
link in an email before the person does. A scanner that opens the button link
consumes the token, so the founder's click then fails and the code fails too.
They can request a new email from the login screen. If this shows up in
support requests, change `/auth/confirm` to show a "Continue" button that
submits a form, because scanners do not submit forms.
