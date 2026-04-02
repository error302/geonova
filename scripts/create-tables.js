const pg = require('pg')
const c = new pg.Client({
  host: '34.170.248.156',
  port: 5432,
  user: 'metardu',
  password: 'Dosho10701$',
  database: 'metardu'
})

async function createTables() {
  await c.connect()
  
  // Table 1: profiles
  console.log('Creating profiles...')
  await c.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      phone TEXT,
      license_number TEXT,
      firm_name TEXT,
      county TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  
  // Insert demo user
  await c.query(`
    INSERT INTO profiles (id, email, full_name) VALUES 
      ('demo-user-1', 'mohameddosho20@gmail.com', 'Mohamed Dosho')
    ON CONFLICT (id) DO NOTHING
  `)
  
  // Table 2: projects
  console.log('Creating projects...')
  await c.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES profiles(id),
      name TEXT NOT NULL,
      location TEXT,
      utm_zone INTEGER,
      hemisphere TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  
  // Table 3: jobs
  console.log('Creating jobs...')
  await c.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES profiles(id),
      name TEXT NOT NULL,
      client TEXT,
      survey_type TEXT,
      location JSONB,
      scheduled_date TIMESTAMPTZ,
      crew_size INTEGER,
      status TEXT DEFAULT 'planned',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  
  // Table 4: equipment_recommendations
  console.log('Creating equipment_recommendations...')
  await c.query(`
    CREATE TABLE IF NOT EXISTS equipment_recommendations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      survey_type TEXT PRIMARY KEY,
      equipment TEXT[]
    )
  `)
  
  // Insert equipment data
  await c.query(`
    INSERT INTO equipment_recommendations (survey_type, equipment) VALUES 
      ('boundary', ARRAY['GPS', 'Total Station', 'Prism']),
      ('topographic', ARRAY['GPS', 'Total Station', 'Level', 'Drones']),
      ('leveling', ARRAY['Digital Level', 'Staff']),
      ('road', ARRAY['GPS', 'Total Station', 'Level'])
    ON CONFLICT (survey_type) DO NOTHING
  `)
  
  // Table 5: job_checklists
  console.log('Creating job_checklists...')
  await c.query(`
    CREATE TABLE IF NOT EXISTS job_checklists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      survey_type TEXT PRIMARY KEY,
      tasks TEXT[]
    )
  `)
  
  await c.query(`
    INSERT INTO job_checklists (survey_type, tasks) VALUES 
      ('boundary', ARRAY['Boundary identification', 'Title search', 'Beacon placement']),
      ('topographic', ARRAY['Control setup', 'Detail survey', 'Data processing'])
    ON CONFLICT (survey_type) DO NOTHING
  `)
  
  console.log('Done!')
  
  // Show tables
  const result = await c.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' ORDER BY table_name
  `)
  console.log('\nTables created:')
  result.rows.forEach(t => console.log(' -', t.table_name))
  
  await c.end()
}

createTables().catch(e => console.error('Error:', e.message))