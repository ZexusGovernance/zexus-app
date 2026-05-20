import { Resend } from 'resend'

export async function sendListingEmail({
  to,
  projectName,
  slug,
  trustScore,
  adminWallet,
}: {
  to: string
  projectName: string
  slug: string
  trustScore: number
  adminWallet?: string | null
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey)
  const profileUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.zexus.xyz'}/projects/${slug}`

  const { error } = await resend.emails.send({
    from:    'Zexus <noreply@zexus.xyz>',
    to,
    subject: `${projectName} has been listed on Zexus ✓`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0b0a09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0a09;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#131210;border:0.5px solid #252320;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:0.5px solid #252320;">
            <p style="margin:0;font-size:18px;font-weight:700;letter-spacing:4px;color:#e8e4dc;">ZEXUS</p>
            <p style="margin:4px 0 0;font-size:10px;letter-spacing:3px;color:#c9a55a;text-transform:uppercase;">The Trust Layer for Web3</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e8e4dc;">
              ${projectName} is now live on Zexus
            </p>
            <p style="margin:0 0 28px;font-size:13px;color:#6e6c66;line-height:1.6;">
              Your project has been reviewed and successfully listed. You can now manage your profile, post updates, and track your Trust Score.
            </p>

            <!-- Trust Score pill -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#1a1916;border:0.5px solid #2e2c28;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0;font-size:10px;color:#6e6c66;text-transform:uppercase;letter-spacing:1.2px;">Initial Trust Score</p>
                  <p style="margin:6px 0 0;font-size:36px;font-weight:800;color:${trustScore >= 70 ? '#4caf7d' : trustScore >= 45 ? '#f0c060' : '#e07070'};">${trustScore}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#6e6c66;">/ 110 pts · ${trustScore < 26 ? 'Not verified' : trustScore < 51 ? 'Basic listing' : trustScore < 76 ? 'Verified' : trustScore < 91 ? 'Trusted' : 'Elite'}</p>
                </td>
              </tr>
            </table>

            <!-- What's next -->
            <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#6e6c66;text-transform:uppercase;letter-spacing:1px;">What to do next</p>
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
              ${adminWallet ? `
              <tr>
                <td style="padding:10px 0;border-bottom:0.5px solid #1a1916;">
                  <p style="margin:0;font-size:13px;color:#e8e4dc;">
                    <span style="color:#c9a55a;">①</span> &nbsp;Connect your admin wallet
                  </p>
                  <p style="margin:3px 0 0;font-size:11px;color:#6e6c66;font-family:monospace;">${adminWallet.slice(0, 10)}…${adminWallet.slice(-6)}</p>
                </td>
              </tr>` : ''}
              <tr>
                <td style="padding:10px 0;border-bottom:0.5px solid #1a1916;">
                  <p style="margin:0;font-size:13px;color:#e8e4dc;"><span style="color:#c9a55a;">${adminWallet ? '②' : '①'}</span> &nbsp;Add your roadmap milestones</p>
                  <p style="margin:3px 0 0;font-size:11px;color:#6e6c66;">Public milestones build trust with your community</p>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <p style="margin:0;font-size:13px;color:#e8e4dc;"><span style="color:#c9a55a;">${adminWallet ? '③' : '②'}</span> &nbsp;Post your first update</p>
                  <p style="margin:3px 0 0;font-size:11px;color:#6e6c66;">Keep your community informed directly on your profile</p>
                </td>
              </tr>
            </table>

            <!-- CTA button -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a1916;border:0.5px solid rgba(255,255,255,0.12);border-radius:10px;">
                  <a href="${profileUrl}" style="display:block;padding:12px 24px;font-size:13px;font-weight:600;color:#e8e4dc;text-decoration:none;">
                    View your profile &nbsp;→
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:0.5px solid #252320;">
            <p style="margin:0;font-size:11px;color:#4a4844;">
              Questions? Reply to this email or write to
              <a href="mailto:hello@zexus.xyz" style="color:#c9a55a;text-decoration:none;">hello@zexus.xyz</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })

  if (error) throw new Error(error.message)
}
