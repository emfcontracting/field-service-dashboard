// app/api/admin/split-comments/route.js
// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME BACKFILL — splits the historic work_orders.comments log into
//   tech_comments : what a person wrote  (invoices bill from this)
//   comments      : what the system wrote (activity log)
//
// Uses the app's own classifier (lib/commentsSplit.js) so the split matches what
// the running code does. Idempotent: only rows with tech_comments_split_at IS
// NULL are touched, and each processed row gets stamped.
//
//   ?dryRun=true   look first — shows counts + a few before/after samples
//   ?limit=500     rows per call (default 500). Re-call until remaining = 0.
//   ?fixup=true    CORRECTIVE pass over rows already split: re-checks
//                  tech_comments against the classifier and moves anything now
//                  recognised as system back into comments. Use this if a new
//                  system format turns up later — nothing is ever deleted, so a
//                  misclassification stays repairable.
//
// Nothing is thrown away: every entry lands in exactly one of the two fields.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { splitCommentLog } from '@/lib/commentsSplit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }

async function handle(request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    searchParams.get('key') !== process.env.CRON_SECRET
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = searchParams.get('dryRun') === 'true';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '500', 10) || 500, 1), 1000);

  const result = { scanned: 0, split: 0, unchanged: 0, errors: [], samples: [], dryRun };

  // ── corrective pass ────────────────────────────────────────────────────────
  if (searchParams.get('fixup') === 'true') {
    const fx = { mode: 'fixup', scanned: 0, fixed: 0, errors: [], samples: [], dryRun };
    const { data: done, error: dErr } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, comments, tech_comments')
      .not('tech_comments_split_at', 'is', null)
      .not('tech_comments', 'is', null)
      .limit(limit);
    if (dErr) return Response.json({ ...fx, error: dErr.message }, { status: 500 });

    for (const wo of done || []) {
      fx.scanned++;
      // Anything in tech_comments the classifier NOW calls system.
      const { comments: stillHuman, notes: nowSystem } = splitCommentLog(wo.tech_comments);
      if (!nowSystem) continue;

      if (fx.samples.length < 5) {
        fx.samples.push({ wo_number: wo.wo_number, moved_to_notes: nowSystem.slice(0, 300) });
      }
      if (dryRun) { fx.fixed++; continue; }

      const mergedNotes = wo.comments ? `${wo.comments}\n\n${nowSystem}` : nowSystem;
      const { error: e } = await supabase
        .from('work_orders')
        .update({ tech_comments: stillHuman, comments: mergedNotes })
        .eq('wo_id', wo.wo_id);
      if (e) { fx.errors.push(`${wo.wo_number}: ${e.message}`); continue; }
      fx.fixed++;
    }
    return Response.json({
      ...fx,
      message: dryRun
        ? `Would move system text out of ${fx.fixed} row(s). Nothing written.`
        : `Corrected ${fx.fixed} row(s).`,
    });
  }


  try {
    const { data: rows, error } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, comments, tech_comments')
      .is('tech_comments_split_at', null)
      .limit(limit);
    if (error) throw new Error(error.message);

    if (!rows?.length) {
      return Response.json({ ...result, remaining: 0, message: 'Nothing left to split.' });
    }
    result.scanned = rows.length;

    const now = new Date().toISOString();

    for (const wo of rows) {
      const { comments, notes } = splitCommentLog(wo.comments);

      // Never clobber a tech_comments value that is already there.
      const nextTech = (wo.tech_comments || '').trim() || comments;

      if (!wo.comments) {
        // Nothing to split — just stamp it so it is not scanned again.
        if (!dryRun) {
          const { error: e } = await supabase
            .from('work_orders')
            .update({ tech_comments_split_at: now })
            .eq('wo_id', wo.wo_id);
          if (e) result.errors.push(`${wo.wo_number}: ${e.message}`);
        }
        result.unchanged++;
        continue;
      }

      if (result.samples.length < 5) {
        result.samples.push({
          wo_number: wo.wo_number,
          before: String(wo.comments).slice(0, 300),
          tech_comments: comments.slice(0, 300),
          comments_after: notes.slice(0, 300),
        });
      }

      if (dryRun) { result.split++; continue; }

      const { error: uErr } = await supabase
        .from('work_orders')
        .update({
          tech_comments: nextTech,
          comments: notes,
          tech_comments_split_at: now,
        })
        .eq('wo_id', wo.wo_id)
        .is('tech_comments_split_at', null);   // idempotent guard
      if (uErr) { result.errors.push(`${wo.wo_number}: ${uErr.message}`); continue; }
      result.split++;
    }

    const { count } = await supabase
      .from('work_orders')
      .select('wo_id', { count: 'exact', head: true })
      .is('tech_comments_split_at', null);

    return Response.json({
      ...result,
      remaining: dryRun ? (count ?? null) : Math.max((count ?? 0), 0),
      message: dryRun
        ? `Would split ${result.split} row(s). Nothing written.`
        : `Split ${result.split} row(s). Re-run until remaining = 0.`,
    });
  } catch (e) {
    return Response.json({ ...result, error: e.message }, { status: 500 });
  }
}
