import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminDashboard from './client';

export const metadata = {
  title: 'Admin Analytics',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/');

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Analytics</h1>
      <p className="text-gray-500 text-sm mb-6">Traffic & Engagement</p>
      <AdminDashboard />
    </div>
  );
}
