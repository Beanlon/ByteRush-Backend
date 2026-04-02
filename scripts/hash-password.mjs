/**
 * Hash a plain password with bcrypt (12 rounds), matching src/routes/auth.ts.
 *
 * Usage:
 *   npm run hash-password -- "your-password"
 *   node scripts/hash-password.mjs "your-password"
 *
 * Avoid shells that log history with real production passwords.
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "<password>"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
