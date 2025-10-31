import bcryptjs from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function resetPassword() {
  try {
    const credentialsPath = path.join(process.cwd(), '.auth.json');
    
    // Get username
    const username = await question('Enter username (default: admin): ');
    const finalUsername = username.trim() || 'admin';
    
    // Get password
    const password = await question('Enter new password: ');
    if (!password || password.trim().length < 6) {
      console.error('Password must be at least 6 characters long');
      process.exit(1);
    }
    
    // Hash password
    console.log('Hashing password...');
    const passwordHash = await bcryptjs.hash(password.trim(), 10);
    
    // Save credentials
    const credentials = {
      username: finalUsername,
      passwordHash
    };
    
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    console.log(`\nCredentials saved successfully!`);
    console.log(`Username: ${finalUsername}`);
    console.log(`Password: [hidden]`);
    console.log(`\nCredentials stored in: ${credentialsPath}`);
    console.log('\nYou can now login with these credentials.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
  }
}

// Run the reset
resetPassword();