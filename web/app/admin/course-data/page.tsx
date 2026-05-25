import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CourseDataReview from './client';

export const metadata = {
  title: 'Course Data Review',
  robots: { index: false, follow: false },
};

export interface Candidate {
  id: string;
  club_id: string;
  source_url: string;
  asset_url: string;
  asset_type: string;
  status: string;
  extracted_data: unknown;
  extraction_notes: string | null;
  discovered_at: string;
  extracted_at: string | null;
  reviewed_at: string | null;
  club: { id: string; name: string; city: string | null; course_data: unknown } | null;
}

export default async function CourseDataAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status || 'extracted';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');

  // Counts per status (single round trip via a tiny RPC would be nicer; for the
  // admin tool the four small queries are fine).
  const [{ count: nDiscovered }, { count: nExtracted }, { count: nApproved }, { count: nFailed }] =
    await Promise.all([
      supabase.from('course_data_candidates').select('id', { count: 'exact', head: true }).eq('status', 'discovered'),
      supabase.from('course_data_candidates').select('id', { count: 'exact', head: true }).eq('status', 'extracted'),
      supabase.from('course_data_candidates').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('course_data_candidates').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    ]);

  const { data: rows, error: queryError } = await supabase
    .from('course_data_candidates')
    .select(`
      id, club_id, source_url, asset_url, asset_type, status,
      extracted_data, extraction_notes,
      discovered_at, extracted_at, reviewed_at,
      club:golf_clubs ( id, name, city, course_data )
    `)
    .eq('status', statusFilter)
    .order('discovered_at', { ascending: false })
    .limit(50);

  if (queryError) {
    console.error('[course-data] query failed:', queryError);
  }
  const candidates = (rows ?? []) as unknown as Candidate[];

  const filters: { key: string; label: string; count: number | null }[] = [
    { key: 'extracted', label: 'Pending Review', count: nExtracted },
    { key: 'discovered', label: 'Awaiting Extraction', count: nDiscovered },
    { key: 'failed', label: 'Failed', count: nFailed },
    { key: 'approved', label: 'Approved', count: nApproved },
  ];

  return (
    <div className="py-6">
      <div className="mb-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-accent">
          ← Admin
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-1">Course Data Review</h1>
      <p className="text-gray-500 text-sm mb-6">
        Pipeline-extracted course ratings, awaiting your approval to promote to <code>golf_clubs.course_data</code>.
      </p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/admin/course-data?status=${f.key}`}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              statusFilter === f.key
                ? 'bg-accent text-white border-accent'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f.label}
            {f.count != null && (
              <span className={`ml-1.5 ${statusFilter === f.key ? 'text-white/80' : 'text-gray-400'}`}>
                ({f.count})
              </span>
            )}
          </Link>
        ))}
      </div>

      {queryError && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          <div className="font-semibold mb-1">Query error</div>
          <pre className="text-xs whitespace-pre-wrap break-all">{queryError.message}</pre>
        </div>
      )}
      <CourseDataReview candidates={candidates} />
    </div>
  );
}
