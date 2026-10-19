# Supabase Auth SMTP setup — owner runbook

Updated 19 October 2026. This is a preparation guide; it records no provider account, SMTP credential, DNS record or Supabase setting as configured.

## Current status

The owner reports that `ohajiugwo-development` is a new Free project using Supabase's built-in email sender, and the Invite User email template is read-only. The owner selected Gmail SMTP using `jackdarzel@gmail.com`, which they identify as their account. The owner reports Google 2-Step Verification is on and a dedicated App Password has been created; its value was not shared or recorded. No SMTP settings or emails have changed. Supabase's Free-tier restriction for new projects means that custom Auth templates become editable after a custom SMTP provider is configured; do not upgrade the project to work around this restriction. Supabase's current custom-SMTP guide says the built-in sender only delivers to addresses on the project's organisation team, with a current limit of two messages per hour and no delivery SLA. The intended recipient is owner-reported as an organisation member, so the default sender may accept that address; however, it cannot use the customized fragment-based one-time link this app requires. Eligibility to receive a default email does not make the secure acceptance flow ready.

The website's public contact remains `ohajiugwochimeziebibi@gmail.com`; the selected SMTP sender is the separate `jackdarzel@gmail.com`. Messages will show that Gmail address as the sender, with a farm display name if configured. No farm-owned sending domain is needed for the selected Gmail route.

| Route | What it needs | Tradeoff |
| --- | --- | --- |
| Selected Gmail account | Owner reports access to `jackdarzel@gmail.com`; confirm Google 2-Step Verification and create an App Password | No domain cost. Google says App Passwords are less secure than Google sign-in. The owner will store this credential directly in Supabase Auth settings. |
| Resend Free (not selected) | Requires an owner-controlled domain and DNS access | Not part of the current setup. |

Resend's `onboarding@resend.dev` example/test sender is not evidence that a real Supabase invitation can be delivered to the farm administrator. Do not use it as a substitute for a verified sender.

## Prepare the selected provider

### Selected route: Gmail SMTP

1. In the owner's Google Account, confirm the mailbox is `jackdarzel@gmail.com` and 2-Step Verification is on.
2. Open [Google App passwords](https://myaccount.google.com/apppasswords) and sign in if prompted. If the option is unavailable, stop; Google documents reasons such as security-key-only 2-Step Verification, Advanced Protection or a managed account.
3. The owner creates a distinct App Password for Supabase Auth and keeps it private. Do not paste it into chat, shell commands, GitHub, source files or this runbook. It can be revoked in Google Account settings; changing the Google Account password also revokes App Passwords.
4. In Supabase SMTP settings use host `smtp.gmail.com`, port `465` with SSL (or `587` with TLS), username and From address `jackdarzel@gmail.com`, the App Password as the password, and sender name `Ohajiugwo Organic Farms Ltd`. Google documents these host/port combinations; the owner enters the App Password directly into Supabase.

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
