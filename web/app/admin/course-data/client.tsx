'use client';

import { useState } from 'react';
import { Check, X, ExternalLink, RotateCcw, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Candidate } from './page';

interface Props {
  candidates: Candidate[];
}

export default function CourseDataReview({ candidates: initial }: Props) {
  const [candidates, setCandidates] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  const remove = (id: string) =>
    setCandidates((cs) => cs.filter((c) => c.id !== id));

  return (
    <div className="space-y-4">
      {candidates.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
          Nothing to review in this bucket.
        </div>
      )}
      {candidates.map((c) => (
        <CandidateRow
          key={c.id}
          candidate={c}
          busy={busyId === c.id}
          onStart={() => setBusyId(c.id)}
          onEnd={() => setBusyId(null)}
          onResolved={() => remove(c.id)}
        />
      ))}
    </div>
  );
}

function CandidateRow({
  candidate,
  busy,
  onStart,
  onEnd,
  onResolved,
}: {
  candidate: Candidate;
  busy: boolean;
  onStart: () => void;
  onEnd: () => void;
  onResolved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    () => JSON.stringify(candidate.extracted_data ?? {}, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setError(null);
    let parsed: Record<string, unknown>;
    try {
      const p = JSON.parse(draft);
      if (p === null || typeof p !== 'object' || Array.isArray(p)) {
        setError('JSON must be an object');
        return;
      }
      parsed = p as Record<string, unknown>;
    } catch (e) {
      setError(`JSON invalid: ${(e as Error).message}`);
      return;
    }
    onStart();
    const supabase = createClient();
    // Merge with existing course_data so manually-seeded fields (photos,
    // holes, description, etc.) survive when promoting a thinner
    // auto-extracted candidate. The candidate's fields win for any keys it
    // provides; existing keys are preserved otherwise.
    const existing =
      (candidate.club?.course_data as Record<string, unknown> | null) ?? {};
    const merged = { ...existing, ...parsed };
    const { error: clubErr } = await supabase
      .from('golf_clubs')
      .update({ course_data: merged })
      .eq('id', candidate.club_id);
    if (clubErr) {
      setError(`promote failed: ${clubErr.message}`);
      onEnd();
      return;
    }
    // 2. Mark candidate approved
    const { error: candErr } = await supabase
      .from('course_data_candidates')
      .update({
        status: 'approved',
        extracted_data: parsed,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', candidate.id);
    if (candErr) {
      setError(`mark approved failed: ${candErr.message}`);
      onEnd();
      return;
    }
    onResolved();
    onEnd();
  }

  async function reject() {
    onStart();
    const supabase = createClient();
    const { error } = await supabase
      .from('course_data_candidates')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', candidate.id);
    if (error) {
      setError(`reject failed: ${error.message}`);
      onEnd();
      return;
    }
    onResolved();
    onEnd();
  }

  async function resetToDiscovered() {
    onStart();
    const supabase = createClient();
    const { error } = await supabase
      .from('course_data_candidates')
      .update({
        status: 'discovered',
        extracted_data: null,
        extraction_notes: null,
        extracted_at: null,
      })
      .eq('id', candidate.id);
    if (error) {
      setError(`reset failed: ${error.message}`);
      onEnd();
      return;
    }
    onResolved();
    onEnd();
  }

  const club = candidate.club;
  const hasExisting = !!club?.course_data;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-semibold text-sm">
            {club?.name ?? candidate.club_id}
            {club?.city && <span className="text-gray-400 font-normal"> · {club.city}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 bg-gray-100 rounded">{candidate.asset_type}</span>
            <a
              href={candidate.asset_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline truncate max-w-md"
            >
              <ExternalLink size={11} /> {candidate.asset_url}
            </a>
            {hasExisting && (
              <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded">
                will overwrite existing course_data
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {candidate.status === 'extracted' && (
            <>
              <button
                onClick={reject}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <X size={14} /> Reject
              </button>
              <button
                onClick={approve}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
              >
                <Check size={14} /> Approve & Promote
              </button>
            </>
          )}
          {candidate.status === 'failed' && (
            <button
              onClick={resetToDiscovered}
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw size={14} /> Reset → discovered
            </button>
          )}
        </div>
      </div>

      {/* Body: side-by-side PDF + JSON */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        <div className="border-r border-gray-100 bg-gray-50 min-h-[500px]">
          {candidate.asset_url.toLowerCase().endsWith('.pdf') ? (
            <iframe
              src={candidate.asset_url}
              className="w-full h-[500px]"
              title="source PDF"
            />
          ) : (
            <div className="p-4 text-sm text-gray-500">
              Asset is not a PDF — open in a new tab via the link above.
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col">
          {candidate.extraction_notes && (
            <div className="mb-3 text-xs px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
              {candidate.extraction_notes}
            </div>
          )}
          {error && (
            <div className="mb-3 text-xs px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Extracted JSON
            </span>
            <button
              onClick={() => setEditing(!editing)}
              className="text-xs text-accent hover:underline inline-flex items-center gap-1"
            >
              {editing ? <Save size={12} /> : 'Edit'}
              {editing ? 'Editing' : ''}
            </button>
          </div>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 font-mono text-xs p-3 bg-gray-50 border border-gray-200 rounded-md resize-none"
              spellCheck={false}
              rows={20}
            />
          ) : (
            <pre className="flex-1 font-mono text-xs p-3 bg-gray-50 border border-gray-200 rounded-md overflow-auto">
              {draft}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
