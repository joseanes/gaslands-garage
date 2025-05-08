// This script helps deploy Firebase security rules
// You'll need to run: npm install -g firebase-tools
// Then log in with: firebase login
// Then run: node deploy-firebase-rules.js

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Project ID from your firebase config
const projectId = 'gaslandsgarage-74ce6'; // Make sure this matches your Firebase project ID

// Check if the rules file exists
const rulesPath = path.join(__dirname, 'firestore.rules');
if (!fs.existsSync(rulesPath)) {
  console.error('Error: Firestore rules file not found at', rulesPath);
  process.exit(1);
}

console.log('Deploying Firestore rules from', rulesPath);
console.log('To Firebase project:', projectId);

// Command to deploy rules
const deployCommand = `firebase deploy --only firestore:rules --project=${projectId}`;

// Execute the deploy command
exec(deployCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('Error deploying rules:', error);
    return;
  }
  
  if (stderr) {
    console.error('Deployment stderr:', stderr);
  }
  
  console.log('Deployment stdout:', stdout);
  console.log('Firestore rules deployed successfully!');
});