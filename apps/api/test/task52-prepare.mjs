import pg from 'pg';
import { spawnSync } from 'node:child_process';

const connectionString = process.env.TASK52_DATABASE_URL;
if (
  !connectionString ||
  !/^brewlite_task52_test(?:_[a-z0-9]+)?$/.test(
    new URL(connectionString).pathname.slice(1),
  )
) {
  throw new Error(
    'Refusing migration/seed: TASK52_DATABASE_URL must name a dedicated brewlite_task52_test database',
  );
}
if (!process.env.npm_execpath)
  throw new Error('Run using pnpm test:task52:prepare');
process.env.DATABASE_URL = connectionString;
function prisma(...args) {
  const result = spawnSync(
    process.execPath,
    [
      process.env.npm_execpath,
      'exec',
      'prisma',
      ...args,
      '--config',
      'prisma7.config.ts',
    ],
    {
      stdio: 'inherit',
      env: process.env,
      windowsHide: true,
    },
  );
  if (result.status !== 0) throw new Error(`Prisma ${args.join(' ')} failed`);
}
prisma('generate');
prisma('migrate', 'deploy');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const counts = async () =>
    (
      await client.query(`SELECT
    (SELECT count(*) FROM "Product") AS products,
    (SELECT count(*) FROM "ProductOption") AS options,
    (SELECT count(*) FROM "Ingredient") AS ingredients,
    (SELECT count(*) FROM "Recipe") AS recipes,
    (SELECT count(*) FROM "RecipeIngredient") AS recipe_ingredients`)
    ).rows[0];
  prisma('db', 'seed');
  const first = await counts();
  prisma('db', 'seed');
  const second = await counts();
  if (JSON.stringify(first) !== JSON.stringify(second))
    throw new Error('Repeated seed duplicated catalog records');
  if (Number(second.products) < 4 || Number(second.recipes) === 0)
    throw new Error('Seed catalog/recipes are missing');
  console.log(
    'Seed repeated successfully without duplicate catalog records:',
    second,
  );
} finally {
  await client.end();
}
