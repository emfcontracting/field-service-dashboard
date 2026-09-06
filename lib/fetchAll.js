// lib/fetchAll.js
// PostgREST returns at most 1000 rows per request no matter what .limit()
// says. Any "load the whole table" query silently truncates once the table
// grows past that (invoices are already at 700+). fetchAll pages through with
// .range() until a short page comes back.
//
//   const rows = await fetchAll(() => supabase.from('invoices').select('…').order('invoice_id'));
//
// The factory must return a fresh query builder each call (builders are
// single-use). Give the query a deterministic .order() so pages don't overlap.
const PAGE = 1000;

export async function fetchAll(makeQuery, { pageSize = PAGE, max = 50000 } = {}) {
  const rows = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

export default fetchAll;
