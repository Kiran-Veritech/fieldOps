"""Transactional email via Resend (registration + password-reset OTP)."""

from __future__ import annotations

import logging
import secrets

import resend

from .config import settings

log = logging.getLogger(__name__)


def generate_otp(digits: int = 6) -> str:
    """Cryptographically strong numeric OTP (zero-padded)."""
    upper = 10**digits
    return f"{secrets.randbelow(upper):0{digits}d}"


def _otp_email_html(
    *,
    full_name: str,
    otp: str,
    expire_minutes: int,
    title: str,
    intro: str,
) -> str:
    first = (full_name or "there").strip().split()[0] or "there"
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} · FieldOps Nexus</title>
</head>
<body style="margin:0;padding:0;background:#04060B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#04060B;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#0B1220;border:1px solid #1E2A3D;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 12px;border-bottom:1px solid #1E2A3D;">
              <div style="font-size:11px;letter-spacing:0.22em;color:#16C0AE;font-weight:700;text-transform:uppercase;">FieldOps Nexus</div>
              <div style="margin-top:14px;font-size:22px;font-weight:700;color:#F0F4FA;line-height:1.3;">{title}</div>
              <div style="margin-top:8px;font-size:14px;color:#97A6BC;line-height:1.55;">
                Hi {first}, {intro}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;" align="center">
              <div style="display:inline-block;background:#070C16;border:1px solid #1E2A3D;border-radius:10px;padding:18px 28px;">
                <div style="font-size:10px;letter-spacing:0.18em;color:#5A6B84;text-transform:uppercase;margin-bottom:10px;">One-time code</div>
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:36px;letter-spacing:0.35em;font-weight:700;color:#3DD5C6;padding-left:0.35em;">
                  {otp}
                </div>
              </div>
              <p style="margin:22px 0 0;font-size:13px;color:#7C89A1;line-height:1.5;">
                This code expires in <strong style="color:#C7D2E1;">{expire_minutes} minutes</strong>.
                If you didn&rsquo;t request it, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid #1E2A3D;">
              <div style="font-size:11px;color:#5A6B84;line-height:1.5;">
                Sent by FieldOps Nexus · Operations coordination for field teams
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _send_otp_email(
    *,
    to_email: str,
    full_name: str,
    otp: str,
    subject: str,
    title: str,
    intro: str,
) -> None:
    api_key = (settings.resend_api_key or "").strip()
    if not api_key or api_key.startswith("re_xxxxxxxxx"):
        raise RuntimeError(
            "RESEND_API_KEY is not configured. Set it in backend/.env to send emails."
        )

    resend.api_key = api_key
    expire = settings.otp_expire_minutes
    first = full_name.split()[0] if full_name.strip() else "there"
    try:
        resend.Emails.send(
            {
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": subject,
                "html": _otp_email_html(
                    full_name=full_name,
                    otp=otp,
                    expire_minutes=expire,
                    title=title,
                    intro=intro,
                ),
                "text": (
                    f"Hi {first},\n\n"
                    f"{intro}\n\n"
                    f"Your code is: {otp}\n\n"
                    f"This code expires in {expire} minutes.\n"
                    "If you did not request this, ignore this email.\n"
                ),
            }
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("Resend send failed for %s", to_email)
        raise RuntimeError(f"Failed to send email: {exc}") from exc


def send_verification_otp(*, to_email: str, full_name: str, otp: str) -> None:
    """Send registration email-verification OTP."""
    _send_otp_email(
        to_email=to_email,
        full_name=full_name,
        otp=otp,
        subject=f"{otp} is your FieldOps Nexus verification code",
        title="Verify your work email",
        intro="use the code below to finish registering and join your team on the live map.",
    )


def send_password_reset_otp(*, to_email: str, full_name: str, otp: str) -> None:
    """Send forgot-password OTP."""
    _send_otp_email(
        to_email=to_email,
        full_name=full_name,
        otp=otp,
        subject=f"{otp} is your FieldOps Nexus password reset code",
        title="Reset your password",
        intro="use the code below to reset your FieldOps Nexus password.",
    )
