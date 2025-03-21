import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xkvioqjqfndsymibgarr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrdmlvcWpxZm5kc3ltaWJnYXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyNDE5NzksImV4cCI6MjA1NDgxNzk3OX0.ps7Hlfg8Bcg4u2nCb0utqki99tdV9JuXiU8EtgyeVGI'

export const supabase = createClient(supabaseUrl, supabaseKey)
