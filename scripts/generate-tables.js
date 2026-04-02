// Parse Supabase migrations and generate CREATE TABLE statements for VM
const fs = require('fs')
const path = require('path')

const migrationsDir = './supabase/migrations'
const files = fs.readdirSync(migrationsDir).sort()

let allTables = new Map()

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
  
  // Find CREATE TABLE statements
  const tableRegex = /CREATE TABLE (?:\w+ )?if not exists (\w+)\s*\(([\s\S]*?)\);/gi
  let match
  
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1]
    const columns = match[2]
    
    if (!allTables.has(tableName)) {
      allTables.set(tableName, columns)
    }
  }
  
  // Also find CREATE TABLE without "if not exists"
  const tableRegex2 = /CREATE TABLE (\w+)\s*\(([\s\S]*?)\);/gi
  while ((match = tableRegex2.exec(content)) !== null) {
    const tableName = match[1]
    if (!allTables.has(tableName)) {
      allTables.set(tableName, match[2])
    }
  }
}

// Generate SQL
let sql = '-- All tables from Supabase migrations\n'
sql += '-- Auto-generated for VM migration\n\n'

// First, create core tables that don't reference other tables
const coreTables = ['projects', 'survey_points', 'profiles', 'jobs', 'equipment', 'equipment_recommendations', 'job_checklists']

for (const [tableName, columns] of allTables) {
  // Simplify columns - remove constraints that reference auth.users
  let simplifiedCols = columns
    .replace(/references auth\.users\(id\).*on delete cascade/gi, 'UUID')
    .replace(/references auth\.users\(id\)/gi, 'UUID')
    .replace(/references projects\(id\).*on delete cascade/gi, 'UUID REFERENCES projects(id)')
    .replace(/references projects\(id\)/gi, 'UUID REFERENCES projects(id)')
    .replace(/gen_random_uuid\(\)/gi, 'gen_random_uuid()')
    .replace(/gen_random_uuid\(\)/gi, 'gen_random_uuid()')
  
  // Remove check constraints for now
  simplifiedCols = simplifiedCols.replace(/check\([^)]+\)/gi, '')
  
  sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`
  
  // Parse and clean each column
  const colLines = simplifiedCols.split(',').map(c => c.trim()).filter(c => c)
  const cleanedCols = colLines.map(col => {
    // Fix common issues
    let fixed = col
      .replace(/uuid primary key default gen_random_uuid\(\)/gi, 'UUID PRIMARY KEY DEFAULT gen_random_uuid()')
      .replace(/timestamptz not null default now\(\)/gi, 'TIMESTAMPTZ DEFAULT NOW()')
      .replace(/boolean not null default false/gi, 'BOOLEAN DEFAULT false')
      .replace(/boolean default false/gi, 'BOOLEAN DEFAULT false')
      .replace(/integer default 0/gi, 'INTEGER DEFAULT 0')
      .replace(/text\[\]/gi, 'TEXT[]')
      .replace(/jsonb\[\]/gi, 'JSONB[]')
    
    // Handle REFERENCES without ON DELETE
    fixed = fixed.replace(/REFERENCES (\w+)\((\w+)\)(\s+on delete \w+)?/gi, 'REFERENCES $1($2)')
    
    return '  ' + fixed
  }).join(',\n')
  
  sql += cleanedCols + '\n);\n\n'
}

// Add tables we created that might be missing
sql += `
-- Additional tables

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  point_id UUID,
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_epochs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  epoch_name TEXT NOT NULL,
  epoch_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  name TEXT NOT NULL,
  geometry JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_type TEXT PRIMARY KEY,
  equipment TEXT[]
);

CREATE TABLE IF NOT EXISTS job_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_type TEXT PRIMARY KEY,
  tasks TEXT[]
);
`

fs.writeFileSync('./sql/supabase-tables.sql', sql)
console.log('Generated SQL with', allTables.size, 'tables')
console.log('Saved to sql/supabase-tables.sql')