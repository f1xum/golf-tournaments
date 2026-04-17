import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  sendNotificationDigests,
  type DigestItem,
  type DigestRecipient,
} from '@/lib/email/send-notification-digest';
import type { NotificationType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  tournament_id: string | null;
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Only production actually generates + emails. Preview/dev deploys share the
  // same Supabase, so running the RPC here would pollute real notifications
  // and sending emails would hit real users.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ skipped: 'non-production', env: process.env.VERCEL_ENV });
  }

  const supabase = createServiceClient();

  const { data: genData, error: genError } = await supabase.rpc('generate_all_notifications');
  if (genError) {
    return NextResponse.json({ error: 'generate failed', details: genError.message }, { status: 500 });
  }
  const generated = Array.isArray(genData) ? genData[0] : genData;

  const { data: pending, error: pendingError } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, tournament_id')
    .is('email_sent_at', null)
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

  if (pendingError) {
    return NextResponse.json({ error: 'fetch pending failed', details: pendingError.message }, { status: 500 });
  }

  const rows = (pending ?? []) as NotificationRow[];
  if (rows.length === 0) {
    return NextResponse.json({ generated, emailed: 0, recipients: 0 });
  }

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);
  if (profilesError) {
    return NextResponse.json({ error: 'fetch profiles failed', details: profilesError.message }, { status: 500 });
  }
  const displayById = new Map<string, string | null>(
    (profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null])
  );

  const emailById = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      return NextResponse.json({ error: 'listUsers failed', details: error.message }, { status: 500 });
    }
    for (const u of data.users) {
      if (u.email && userIds.includes(u.id)) emailById.set(u.id, u.email);
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  const recipients: DigestRecipient[] = [];
  const skipped: { userId: string; reason: string }[] = [];

  for (const userId of userIds) {
    const email = emailById.get(userId);
    if (!email) {
      skipped.push({ userId, reason: 'no email' });
      continue;
    }
    const items: DigestItem[] = rows
      .filter((r) => r.user_id === userId)
      .map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        tournament_id: r.tournament_id,
      }));
    recipients.push({
      userId,
      email,
      displayName: displayById.get(userId) ?? null,
      items,
    });
  }

  const results = await sendNotificationDigests(recipients);

  const sentIds = results.flatMap((r) => r.sentIds);
  if (sentIds.length > 0) {
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ email_sent_at: new Date().toISOString() })
      .in('id', sentIds);
    if (updateError) {
      return NextResponse.json(
        {
          generated,
          emailed: sentIds.length,
          recipients: recipients.length,
          markError: updateError.message,
          failed: results.filter((r) => r.error),
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    generated,
    emailed: sentIds.length,
    recipients: recipients.length,
    skipped,
    failed: results.filter((r) => r.error).map((r) => ({ userId: r.userId, error: r.error })),
  });
}
