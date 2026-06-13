import { createClient } from '@supabase/supabase-js';
import { requiredEnv } from './config';

let client;

function supabaseProjectUrl() {
  const value = requiredEnv('SUPABASE_URL').trim();
  return value
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '');
}

export function supabaseAdmin() {
  if (!client) {
    client = createClient(
      supabaseProjectUrl(),
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
