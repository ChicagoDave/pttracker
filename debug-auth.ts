import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function debugAuth() {
  console.log('=== Authentication Debug Info ===\n');
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log('AUTH_USERNAME:', process.env.AUTH_USERNAME || '[NOT SET - defaults to "admin"]');
  console.log('AUTH_PASSWORD:', process.env.AUTH_PASSWORD ? '[SET]' : '[NOT SET - defaults to "change_me"]');
  console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? '[SET]' : '[NOT SET]');
  
  // Show what the current implementation does
  console.log('\n=== Current Implementation Issue ===');
  console.log('The current auth.ts implementation:');
  console.log('1. Hashes the password on EVERY server start');
  console.log('2. Does NOT store the hash persistently');
  console.log('3. If AUTH_PASSWORD is not set in .env, it uses "change_me"');
  
  // Test password hashing
  console.log('\n=== Testing Password Hashing ===');
  const testPassword = process.env.AUTH_PASSWORD || 'change_me';
  const hash1 = await bcryptjs.hash(testPassword, 10);
  const hash2 = await bcryptjs.hash(testPassword, 10);
  
  console.log('Password being used:', testPassword);
  console.log('Hash 1:', hash1);
  console.log('Hash 2:', hash2);
  console.log('Hashes are different?', hash1 !== hash2);
  console.log('This shows why the current implementation fails - new hash each time!');
  
  // Test password verification
  console.log('\n=== Testing Password Verification ===');
  const testInputs = ['change_me', 'admin', 'password', process.env.AUTH_PASSWORD].filter(Boolean);
  
  for (const input of testInputs) {
    const matches = await bcryptjs.compare(input, hash1);
    console.log(`Password "${input}" matches hash?`, matches);
  }
  
  console.log('\n=== Solution ===');
  console.log('1. Add AUTH_USERNAME and AUTH_PASSWORD to your .env file');
  console.log('2. Replace the current auth.ts with auth-fixed.ts');
  console.log('3. Run reset-password.ts to create a persistent password hash');
  console.log('4. Restart the server');
}

debugAuth().catch(console.error);