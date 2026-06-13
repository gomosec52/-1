import { createClient } from '@supabase/supabase-js';
import { requiredEnv } from './config';

let client;

export function supabaseAdmin() {
  if (!client) {
    client = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
  }
  return client;
}
