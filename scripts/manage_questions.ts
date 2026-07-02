import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Load environment variables from .env.local or .env
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ Error: DATABASE_URL is not defined in environment or .env.local");
  process.exit(1);
}

const sql = neon(dbUrl);

export interface QuestionItem {
  caseId: string;
  puzzleKey: string;
  question: string;
  answer: string;
}

/**
 * Upsert (Insert or Update) a single question in the database.
 */
export async function upsertQuestion(item: QuestionItem): Promise<void> {
  const { caseId, puzzleKey, question, answer } = item;

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
    console.log(`✏️  Updated question for Case [${caseId}], Puzzle Key [${puzzleKey}]`);
  } else {
    await sql`
      INSERT INTO case_questions (id, case_id, puzzle_key, question, answer)
      VALUES (gen_random_uuid(), ${caseId}, ${puzzleKey}, ${question}, ${answer});
    `;
    console.log(`➕ Added new question for Case [${caseId}], Puzzle Key [${puzzleKey}]`);
  }
}

/**
 * Import questions from a JSON file and upsert into database.
 */
export async function importQuestionsFromFile(filePath: string): Promise<number> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found at path: ${absolutePath}`);
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf-8');
  const items: QuestionItem[] = JSON.parse(fileContent);

  if (!Array.isArray(items)) {
    throw new Error(`Invalid format in ${filePath}. Expected an array of questions.`);
  }

  console.log(`📦 Importing ${items.length} question(s) from JSON file: ${filePath}...`);

  let count = 0;
  for (const item of items) {
    if (!item.caseId || !item.puzzleKey || !item.question || item.answer === undefined) {
      console.warn(`⚠️ Skipping invalid item:`, item);
      continue;
    }
    await upsertQuestion(item);
    count++;
  }

  console.log(`✅ Bulk JSON import completed! (${count}/${items.length} items processed)\n`);
  return count;
}

/**
 * Parse line-by-line CSV simple parser supporting quotes and commas.
 */
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').replace(/^["']|["']$/g, '');
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Import questions from a CSV file.
 */
export async function importQuestionsFromCSV(filePath: string): Promise<number> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found at path: ${absolutePath}`);
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf-8');
  const rows = parseCSV(fileContent);

  console.log(`📊 Importing ${rows.length} row(s) from CSV file: ${filePath}...`);

  let count = 0;
  for (const row of rows) {
    const caseId = row.caseId || row.case_id || row.case;
    const puzzleKey = row.puzzleKey || row.puzzle_key || row.key;
    const question = row.question || row.q;
    const answer = row.answer || row.a;

    if (!caseId || !puzzleKey || !question || answer === undefined) {
      console.warn(`⚠️ Skipping invalid row in CSV:`, row);
      continue;
    }

    await upsertQuestion({ caseId, puzzleKey, question, answer });
    count++;
  }

  console.log(`✅ Bulk CSV import completed! (${count}/${rows.length} rows processed)\n`);
  return count;
}

/**
 * List all questions in database, optionally filtered by Case ID.
 */
export async function listQuestions(caseIdFilter?: string) {
  let rows;
  if (caseIdFilter) {
    rows = await sql`
      SELECT case_id as "caseId", puzzle_key as "puzzleKey", question, answer 
      FROM case_questions 
      WHERE case_id = ${caseIdFilter}
      ORDER BY puzzle_key ASC;
    `;
    console.log(`\n📋 Listing questions for Case: ${caseIdFilter} (${rows.length} found)`);
  } else {
    rows = await sql`
      SELECT case_id as "caseId", puzzle_key as "puzzleKey", question, answer 
      FROM case_questions 
      ORDER BY case_id ASC, puzzle_key ASC;
    `;
    console.log(`\n📋 Listing ALL questions in DB (${rows.length} total)`);
  }

  console.log('─'.repeat(80));
  if (rows.length === 0) {
    console.log('   (No questions found)');
  } else {
    rows.forEach((r: any, idx: number) => {
      console.log(`${idx + 1}. [Case ${r.caseId}] Key: ${r.puzzleKey}`);
      console.log(`   Q: ${r.question}`);
      console.log(`   A: ${r.answer}`);
      console.log('─'.repeat(80));
    });
  }
  return rows;
}

/**
 * Export all questions from database to a JSON file.
 */
export async function exportQuestionsToJson(outputPath?: string) {
  const targetPath = outputPath || path.join(process.cwd(), 'data/questions_backup.json');
  const rows = await sql`
    SELECT case_id as "caseId", puzzle_key as "puzzleKey", question, answer 
    FROM case_questions 
    ORDER BY case_id ASC, puzzle_key ASC;
  `;

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(targetPath, JSON.stringify(rows, null, 2), 'utf-8');
  console.log(`✅ Successfully exported ${rows.length} question(s) to ${targetPath}\n`);
}

/**
 * Delete a question by caseId and puzzleKey.
 */
export async function deleteQuestion(caseId: string, puzzleKey: string) {
  const result = await sql`
    DELETE FROM case_questions 
    WHERE case_id = ${caseId} AND puzzle_key = ${puzzleKey}
    RETURNING id;
  `;
  if (result.length > 0) {
    console.log(`🗑️  Successfully deleted question for Case: ${caseId}, Puzzle Key: ${puzzleKey}`);
  } else {
    console.log(`⚠️  No question found matching Case: ${caseId}, Puzzle Key: ${puzzleKey}`);
  }
}

/**
 * Seed initial/default questions from data/questions.json
 */
export async function seedDefaultQuestions() {
  const seedFile = path.join(process.cwd(), 'data/questions.json');
  if (fs.existsSync(seedFile)) {
    console.log(`🌱 Seeding default questions from data/questions.json...`);
    await importQuestionsFromFile(seedFile);
  } else {
    console.log(`⚠️ Default seed file not found at data/questions.json`);
  }
}

// ---------------------------------------------------------
// CLI Argument Parser & Interactive Interface
// ---------------------------------------------------------

async function runInteractiveMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (query: string): Promise<string> => {
    return new Promise(resolve => rl.question(query, resolve));
  };

  while (true) {
    console.log(`
===================================================
  🧩 CRYPTIC HUNT - QUESTION DB MANAGEMENT SCRIPT
===================================================
1. ➕ Add / Update a single question
2. 📋 List all questions
3. 🔍 List questions by Case ID
4. 📦 Import questions from JSON file
5. 📊 Import questions from CSV file
6. 💾 Export all questions to JSON file
7. 🌱 Seed default questions (data/questions.json)
8. 🗑️  Delete a question
9. ❌ Exit
`);

    const choice = (await ask("Select an option (1-9): ")).trim();

    try {
      switch (choice) {
        case '1': {
          const caseId = (await ask("Enter Case ID (e.g. 04): ")).trim();
          const puzzleKey = (await ask("Enter Puzzle Key (e.g. fake_login): ")).trim();
          const question = (await ask("Enter Question Text: ")).trim();
          const answer = (await ask("Enter Answer: ")).trim();
          if (caseId && puzzleKey && question && answer) {
            await upsertQuestion({ caseId, puzzleKey, question, answer });
          } else {
            console.log("⚠️ All fields are required!");
          }
          break;
        }
        case '2':
          await listQuestions();
          break;
        case '3': {
          const caseId = (await ask("Enter Case ID to filter (e.g. 04): ")).trim();
          if (caseId) await listQuestions(caseId);
          break;
        }
        case '4': {
          const file = (await ask("Enter JSON file path [default: data/questions.json]: ")).trim() || 'data/questions.json';
          await importQuestionsFromFile(file);
          break;
        }
        case '5': {
          const file = (await ask("Enter CSV file path (e.g. data/questions.csv): ")).trim();
          if (file) await importQuestionsFromCSV(file);
          break;
        }
        case '6': {
          const file = (await ask("Enter export JSON file path [default: data/questions_backup.json]: ")).trim();
          await exportQuestionsToJson(file || undefined);
          break;
        }
        case '7':
          await seedDefaultQuestions();
          break;
        case '8': {
          const caseId = (await ask("Enter Case ID: ")).trim();
          const puzzleKey = (await ask("Enter Puzzle Key: ")).trim();
          if (caseId && puzzleKey) {
            await deleteQuestion(caseId, puzzleKey);
          } else {
            console.log("⚠️ Case ID and Puzzle Key required.");
          }
          break;
        }
        case '9':
          console.log("Goodbye! 👋");
          rl.close();
          process.exit(0);
        default:
          console.log("Invalid option. Please choose 1-9.");
      }
    } catch (err: any) {
      console.error("❌ Operation failed:", err?.message || err);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await runInteractiveMenu();
    return;
  }

  const command = args[0].toLowerCase().replace(/^--?/, '');

  try {
    switch (command) {
      case 'seed':
        await seedDefaultQuestions();
        break;
      case 'list': {
        const caseIdx = args.indexOf('--case');
        const caseId = caseIdx !== -1 ? args[caseIdx + 1] : undefined;
        await listQuestions(caseId);
        break;
      }
      case 'import': {
        const fileIdx = args.indexOf('--file');
        const file = fileIdx !== -1 ? args[fileIdx + 1] : args[1];
        if (!file) {
          console.error("Error: Please specify --file <path/to/file.json>");
          process.exit(1);
        }
        if (file.endsWith('.csv')) {
          await importQuestionsFromCSV(file);
        } else {
          await importQuestionsFromFile(file);
        }
        break;
      }
      case 'export': {
        const fileIdx = args.indexOf('--file');
        const file = fileIdx !== -1 ? args[fileIdx + 1] : args[1];
        await exportQuestionsToJson(file);
        break;
      }
      case 'add': {
        const caseIdx = args.indexOf('--case');
        const keyIdx = args.indexOf('--key');
        const qIdx = args.indexOf('--question');
        const aIdx = args.indexOf('--answer');

        const caseId = caseIdx !== -1 ? args[caseIdx + 1] : null;
        const puzzleKey = keyIdx !== -1 ? args[keyIdx + 1] : null;
        const question = qIdx !== -1 ? args[qIdx + 1] : null;
        const answer = aIdx !== -1 ? args[aIdx + 1] : null;

        if (!caseId || !puzzleKey || !question || !answer) {
          console.error("Error: --case, --key, --question, and --answer flags are required for 'add'.");
          process.exit(1);
        }

        await upsertQuestion({ caseId, puzzleKey, question, answer });
        break;
      }
      case 'delete': {
        const caseIdx = args.indexOf('--case');
        const keyIdx = args.indexOf('--key');
        const caseId = caseIdx !== -1 ? args[caseIdx + 1] : null;
        const puzzleKey = keyIdx !== -1 ? args[keyIdx + 1] : null;

        if (!caseId || !puzzleKey) {
          console.error("Error: --case and --key flags are required for 'delete'.");
          process.exit(1);
        }

        await deleteQuestion(caseId, puzzleKey);
        break;
      }
      case 'help':
      default:
        console.log(`
🧩 Question DB Management Tool Flags:
  --seed                            Seed questions from data/questions.json
  --list [--case <caseId>]          List all questions or filter by case
  --import --file <path.json|csv>   Bulk import questions from JSON/CSV file
  --export [--file <path.json>]     Export all DB questions to JSON file
  --add --case <id> --key <key> --question <q> --answer <a>
                                    Add or update a single question
  --delete --case <id> --key <key>  Delete a question from DB
`);
        break;
    }
  } catch (error: any) {
    console.error("❌ Command failed:", error?.message || error);
    process.exit(1);
  }
}

main();
