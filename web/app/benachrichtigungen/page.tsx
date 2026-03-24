import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Notification, Tournament } from '@/lib/types';
import NotificationList from './notification-list';

export const metadata = {
  title: 'Benachrichtigungen – The Pin',
};

export default async function BenachrichtigungenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const items = (notifications ?? []) as Notification[];

  // Fetch linked tournaments for context
  const tournamentIds = [...new Set(items.map((n) => n.tournament_id).filter(Boolean))] as string[];
  let tournamentsMap: Record<string, Tournament> = {};

  if (tournamentIds.length > 0) {
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .in('id', tournamentIds);
    (tournaments ?? []).forEach((t) => {
      tournamentsMap[t.id] = t as Tournament;
    });
  }

  return (
    <div className="py-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Benachrichtigungen</h1>
      <NotificationList notifications={items} tournaments={tournamentsMap} />
    </div>
  );
}
