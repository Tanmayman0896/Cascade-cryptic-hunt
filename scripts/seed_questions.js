const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local or .env
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Error: DATABASE_URL or DIRECT_DATABASE_URL is not defined in environment, .env, or .env.local");
  process.exit(1);
}

const sql = neon(dbUrl);

async function run() {
  const jsonPath = path.join(__dirname, '../data/questions.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: questions.json not found at ${jsonPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(jsonPath, 'utf-8');
  const questions = JSON.parse(fileContent);

  if (!Array.isArray(questions)) {
    console.error("Error: questions.json format is invalid, expected an array.");
    process.exit(1);
  }

  console.log(`Seeding ${questions.length} questions into case_questions table...`);

  let inserted = 0;
  let updated = 0;

  for (const q of questions) {
    const { caseId, puzzleKey, question, answer } = q;
    
    if (!caseId || !puzzleKey || !question || answer === undefined) {
      console.warn(`Skipping invalid item:`, q);
      continue;
    }

    const existing = await sql`
      SELECT id FROM case_questions 
      WHERE case_id = ${caseId} AND puzzle_key = ${puzzleKey};
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE case_questions 
        SET question = ${question}, answer = ${answer}
        WHERE case_id = ${caseId} AND puzzle_key = ${puzzleKey};
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO case_questions (id, case_id, puzzle_key, question, answer)
        VALUES (gen_random_uuid(), ${caseId}, ${puzzleKey}, ${question}, ${answer});
      `;
      inserted++;
    }
  }

  console.log(` Seeding completed!`);
  console.log(`   Added:   ${inserted}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total processed: ${inserted + updated}/${questions.length}`);
}

run().catch(err => {
  console.error(" Seeding failed:", err);
  process.exit(1);
});
