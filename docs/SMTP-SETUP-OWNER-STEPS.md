# Supabase Auth SMTP setup — owner runbook

Updated 18 October 2026. This is a preparation guide; it records no provider account, SMTP credential, DNS record or Supabase setting as configured.

## Current status

The owner reports that `ohajiugwo-development` is a new Free project using Supabase's built-in email sender, and the Invite User email template is read-only. The owner reopened SMTP setup, but has not chosen a provider. No email has been sent. Supabase's Free-tier restriction for new projects means that custom Auth templates become editable after a custom SMTP provider is configured; do not upgrade the project to work around this restriction.

The existing website contact is `ohajiugwochimeziebibi@gmail.com`; ownership and 2-Step Verification status are unconfirmed. No farm-owned sending domain is configured in the repository/hosting records. Choose one route before changing Supabase settings:

| Route | What it needs | Tradeoff |
| --- | --- | --- |
| Existing farm Gmail | Owner controls the contact Gmail account; Google 2-Step Verification is enabled; owner creates an App Password | No domain cost. Google says App Passwords are less secure than Google sign-in. Use only if the owner accepts storing this credential in Supabase Auth settings. |
| Resend Free | Owner controls a domain and its DNS settings; verify the domain and configure its email-authentication records | Domain-based sender and dedicated SMTP service. The free tier currently lists 3,000 emails/month, 100/day and three verified domains; a domain registration is separate and may cost money. |

Resend's `onboarding@resend.dev` example/test sender is not evidence that a real Supabase invitation can be delivered to the farm administrator. Do not use it as a substitute for a verified sender.

## Prepare the selected provider

### If choosing the farm Gmail account

1. In the owner's Google Account, confirm the mailbox is `ohajiugwochimeziebibi@gmail.com` and that 2-Step Verification is enabled.
2. Open **Google Account → Security → App passwords**. If that option is unavailable, stop; Google documents reasons such as security-key-only 2-Step Verification, Advanced Protection or a managed account.
3. The owner creates a distinct App Password for Supabase Auth and keeps it private. Do not paste it into chat, shell commands, GitHub, source files or this runbook. It can be revoked in Google Account settings; changing the Google Account password also revokes App Passwords.
4. In Supabase SMTP settings use the account's SMTP details: host `smtp.gmail.com`, port `465` with SSL (or `587` with TLS), full Gmail address as username, the newly generated App Password as password, and the same Gmail address as the From address. The owner enters the credential directly into Supabase.

### If choosing Resend

1. The owner creates/signs in to the Resend account and adds a domain they control.
2. Resend shows the DNS records it requires. The owner adds those exact records at the authoritative DNS provider, taking care not to overwrite unrelated existing mail records, then waits for Resend to show the domain as verified for sending.
3. The owner creates the narrowest available sending-only key for the selected domain and stores it privately. Do not paste it into chat, shell commands, GitHub or source files. The owner enters it directly into Supabase as the SMTP password.
4. Use host `smtp.resend.com`, port `465`, username `resend`, the Resend key as password, and a From address on the verified domain. A farm domain purchase or paid provider action needs separate approval.

## Configure the existing Supabase project

After choosing and preparing exactly one provider, the owner opens the existing `ohajiugwo-development` project and navigates to **Authentication → Settings → SMTP Settings** (dashboard labels can vary). Enable custom SMTP and enter the provider host, port, username, password, From address and sender name. Keep email confirmation enabled and do not enable public signup. Save the settings; do not send a test email yet.

Then:

1. Open **Authentication → URL Configuration** and allow the exact Preview acceptance URL `https://stage2-preview.ohajiugwo-farms-development.pages.dev/admin/accept`.
2. Open **Authentication → Email Templates → Invite User** and confirm the subject/body are now editable.
3. Change the invitation link target so it appends `&amp;token_hash={{ .TokenHash }}` to `{{ .RedirectTo }}`. The current app redirect already contains the invitation id and nonce in the URL fragment; appending the token hash keeps the single-use credentials in that fragment for the acceptance page to clear before any request. Disable provider click tracking for Auth emails.
4. Report only whether custom SMTP is enabled, whether the template and exact redirect are saved, and whether the redirect URL is allowlisted. Never paste the SMTP password, App Password, Resend key, or invitation link.

The first-admin CLI stays gated until these prerequisites are reported as complete. The previously approved one-time invitation is not sent by this runbook. After setup, provider/API acceptance is still not proof of inbox delivery or successful browser acceptance; record those separately. The Preview remains unindexed and `main`/production is unchanged.

## Sources

- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase email templates and link prefetching](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase redirect URL allowlist](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google App Passwords](https://support.google.com/accounts/answer/185833)
- [Google SMTP setup](https://support.google.com/a/answer/176600)
- [Resend pricing](https://resend.com/pricing)
