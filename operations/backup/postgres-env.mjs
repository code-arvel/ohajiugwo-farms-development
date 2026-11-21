import path from 'node:path';
import { lstat } from 'node:fs/promises';

const ALLOWED = new Set(['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSFILE','PGSSLMODE','PGSSLROOTCERT','PGCONNECT_TIMEOUT']);
/** Explicit libpq input only; no inherited shell variables, URI or inline password. */
export function postgresEnvironment(input) {
  if (!input || typeof input !== 'object' || Object.keys(input).some(key=>!ALLOWED.has(key))) throw new Error('Disallowed database environment');
  if (!/^[a-zA-Z0-9.-]{1,253}$/.test(input.PGHOST ?? '') || input.PGHOST.includes('..')) throw new Error('Explicit database host environment required');
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(input.PGDATABASE ?? '') || !/^[a-zA-Z0-9_.-]{1,128}$/.test(input.PGUSER ?? '') || !path.isAbsolute(input.PGPASSFILE ?? '') || /[\r\n\0]/.test(input.PGPASSFILE) || input.PGSSLMODE !== 'verify-full') throw new Error('Verified TLS and absolute private passfile environment required');
  if (input.PGPORT && (!/^\d{1,5}$/.test(input.PGPORT) || +input.PGPORT<1 || +input.PGPORT>65535)) throw new Error('Invalid database port environment');
  if (input.PGSSLROOTCERT && !path.isAbsolute(input.PGSSLROOTCERT)) throw new Error('Absolute trusted root certificate required');
  if (input.PGCONNECT_TIMEOUT && (!/^\d{1,2}$/.test(input.PGCONNECT_TIMEOUT) || +input.PGCONNECT_TIMEOUT<1 || +input.PGCONNECT_TIMEOUT>60)) throw new Error('Bounded database connection timeout required');
  return {...input,PGCONNECT_TIMEOUT:input.PGCONNECT_TIMEOUT ?? '15',PGAPPNAME:'farm-independent-backup',PGCLIENTENCODING:'UTF8',LC_ALL:'C'};
}
export async function verifyPassfile(file) {
  const stat = await lstat(file).catch(()=>{throw new Error('Private database passfile unavailable');});
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())) throw new Error('Database passfile must be owner-controlled mode 0600');
}
