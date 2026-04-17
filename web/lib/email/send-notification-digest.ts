import { Resend } from 'resend';
import type { NotificationType } from '@/lib/types';

export interface DigestItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  tournament_id: string | null;
}

export interface DigestRecipient {
  userId: string;
  email: string;
  displayName: string | null;
  items: DigestItem[];
}

export interface DigestResult {
  userId: string;
  email: string;
  sentIds: string[];
  error?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thepin.app';

const TYPE_HEADINGS: Record<NotificationType, string> = {
  tournament_reminder: 'Bald geht\u2019s los',
  registration_closing: 'Meldeschluss steht an',
  new_tournament_nearby: 'Neu in deiner N\u00e4he',
  hcp_match: 'Passend zu deinem HCP',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(recipient: DigestRecipient): string {
  const greeting = recipient.displayName
    ? `Hallo ${escapeHtml(recipient.displayName)},`
    : 'Hallo,';

  const byType = new Map<NotificationType, DigestItem[]>();
  for (const item of recipient.items) {
    const list = byType.get(item.type) ?? [];
    list.push(item);
    byType.set(item.type, list);
  }

  const sections = Array.from(byType.entries())
    .map(([type, items]) => {
      const rows = items
        .map((item) => {
          const link = item.tournament_id
            ? `${APP_URL}/turniere/${item.tournament_id}`
            : APP_URL;
          const body = item.body ? escapeHtml(item.body) : '';
          return `
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;">
                <a href="${link}" style="color:#1B4332;font-weight:600;text-decoration:none;">${escapeHtml(item.title)}</a>
                ${body ? `<div style="color:#555;font-size:14px;margin-top:4px;">${body}</div>` : ''}
              </td>
            </tr>`;
        })
        .join('');
      return `
        <h2 style="font-size:16px;color:#1B4332;margin:24px 0 8px;">${TYPE_HEADINGS[type]}</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
    })
    .join('');

  return `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#f7f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5;padding:24px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px;max-width:100%;">
          <tr><td>
            <div style="font-size:18px;font-weight:700;color:#1B4332;margin-bottom:16px;">The Pin</div>
            <p style="margin:0 0 8px;">${greeting}</p>
            <p style="margin:0 0 16px;color:#555;">Hier sind deine aktuellen Turnier-Updates:</p>
            ${sections}
            <p style="margin:32px 0 0;font-size:12px;color:#888;">
              <a href="${APP_URL}/profil/einstellungen" style="color:#888;">Benachrichtigungen verwalten</a>
              &nbsp;\u00b7&nbsp;
              <a href="${APP_URL}" style="color:#888;">thepin.app</a>
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function subjectFor(recipient: DigestRecipient): string {
  if (recipient.items.length === 1) {
    return `The Pin — ${recipient.items[0].title}`;
  }
  return `The Pin — ${recipient.items.length} neue Turnier-Updates`;
}

export async function sendNotificationDigests(
  recipients: DigestRecipient[]
): Promise<DigestResult[]> {
  if (recipients.length === 0) return [];

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'The Pin <onboarding@resend.dev>';
  if (!apiKey) throw new Error('Missing RESEND_API_KEY');

  const resend = new Resend(apiKey);
  const results: DigestResult[] = [];

  for (const recipient of recipients) {
    try {
      const { error } = await resend.emails.send({
        from,
        to: recipient.email,
        subject: subjectFor(recipient),
        html: renderHtml(recipient),
      });
      if (error) {
        results.push({
          userId: recipient.userId,
          email: recipient.email,
          sentIds: [],
          error: error.message,
        });
      } else {
        results.push({
          userId: recipient.userId,
          email: recipient.email,
          sentIds: recipient.items.map((i) => i.id),
        });
      }
    } catch (err) {
      results.push({
        userId: recipient.userId,
        email: recipient.email,
        sentIds: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
