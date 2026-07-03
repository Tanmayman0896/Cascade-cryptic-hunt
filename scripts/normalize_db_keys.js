const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

async function main() {
  const rows = await sql`SELECT id, case_id, puzzle_key FROM case_questions WHERE puzzle_key LIKE '%-%'`;
  console.log(`Found ${rows.length} hyphenated keys:`);

  for (const row of rows) {
    const newKey = row.puzzle_key.replaceAll('-', '_');
    // Check if the underscore version already exists
    const existing = await sql`
      SELECT id FROM case_questions WHERE case_id = ${row.case_id} AND puzzle_key = ${newKey}
    `;
    if (existing.length > 0) {
      await sql`DELETE FROM case_questions WHERE id = ${row.id}`;
      console.log(`  DELETED duplicate: [${row.case_id}] ${row.puzzle_key} (underscore version exists)`);
    } else {
      await sql`UPDATE case_questions SET puzzle_key = ${newKey} WHERE id = ${row.id}`;
      console.log(`  RENAMED: [${row.case_id}] ${row.puzzle_key} → ${newKey}`);
    }
  }
  console.log('Done.');
}
main().catch(e => { console.error(e); process.exit(1); });
