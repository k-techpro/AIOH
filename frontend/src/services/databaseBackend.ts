export function resolveDatabaseBackend(configured?: string): 'neon' | 'firestore' {
  const backend = configured || 'neon';
  if (!['neon', 'firestore'].includes(backend)) throw new Error('DATABASE_BACKEND must be neon or firestore.');
  return backend as 'neon' | 'firestore';
}

// Future Android builds fail safe to Neon. Firestore stays an explicit legacy
// option only; the production rules freeze must still block already-installed
// clients during the coordinated cutover.
export const DATABASE_BACKEND = resolveDatabaseBackend(process.env.EXPO_PUBLIC_DATABASE_BACKEND);
export const IS_NEON = DATABASE_BACKEND === 'neon';
