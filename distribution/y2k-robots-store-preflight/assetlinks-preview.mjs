/**
 * Y2K ROBOTS · Generate a Digital Asset Links JSON PREVIEW from a verified
 * real Play App Signing certificate SHA-256 fingerprint. NO FILE WRITE.
 * No network, no signing, no account access, no auto-publish.
 * Usage:
 *   node assetlinks-preview.mjs --package technology.unfire.y2krobots --sha256 XX:...:XX
 */
import { fileURLToPath } from 'node:url';

export function buildAssetLinks({ packageName, fingerprint }) {
  if (typeof packageName !== 'string' || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$/.test(packageName)) {
    throw new Error('Invalid Android package name; confirm the exact Play Console application ID.');
  }
  if (typeof fingerprint !== 'string' || !/^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/.test(fingerprint)) {
    throw new Error('Missing or invalid SHA-256 certificate fingerprint; require exactly 32 hexadecimal bytes separated by colons.');
  }
  const value = fingerprint.toUpperCase();
  if (/^(00:){31}00$/.test(value)) throw new Error('Placeholder fingerprint is forbidden.');
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: [value]
    }
  }];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const p = process.argv.indexOf('--package');
  const s = process.argv.indexOf('--sha256');
  try {
    if (p < 0 || s < 0 || !process.argv[p+1] || !process.argv[s+1]) throw new Error('Both --package and --sha256 are required.');
    process.stdout.write(JSON.stringify(buildAssetLinks({
      packageName: process.argv[p+1],
      fingerprint: process.argv[s+1]
    }), null, 2) + '\n');
  } catch (error) {
    process.stderr.write('NOT GENERATED: ' + error.message + '\n');
    process.exitCode = 2;
  }
}
