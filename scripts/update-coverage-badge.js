#!/usr/bin/env node

/**
 * Script to update the coverage badge in README.md based on the latest coverage report
 */

const fs = require('fs');
const path = require('path');

function getCoveragePercentage() {
  try {
    // Try to read from coverage-summary.json first (CI format)
    const summaryPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      const total = summary.total;
      if (total && total.statements && total.statements.pct !== undefined) {
        return Math.round(total.statements.pct * 100) / 100;
      }
    }

    // Fallback: try to parse from coverage-final.json
    const finalPath = path.join(__dirname, '..', 'coverage', 'coverage-final.json');
    if (fs.existsSync(finalPath)) {
      const coverage = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
      const files = Object.values(coverage);
      if (files.length === 0) return null;

      let totalStatements = 0;
      let coveredStatements = 0;

      files.forEach(file => {
        if (file.s) {
          Object.values(file.s).forEach(count => {
            totalStatements++;
            if (count > 0) coveredStatements++;
          });
        }
      });

      if (totalStatements > 0) {
        return Math.round((coveredStatements / totalStatements) * 10000) / 100;
      }
    }

    return null;
  } catch (error) {
    console.error('Error reading coverage data:', error.message);
    return null;
  }
}

function updateReadmeBadge(coverage) {
  const readmePath = path.join(__dirname, '..', 'README.md');
  
  if (!fs.existsSync(readmePath)) {
    console.error('README.md not found');
    return false;
  }

  let readme = fs.readFileSync(readmePath, 'utf8');
  
  // Determine badge color based on coverage percentage
  let color = 'red';
  if (coverage >= 90) color = 'brightgreen';
  else if (coverage >= 80) color = 'green';
  else if (coverage >= 70) color = 'yellowgreen';
  else if (coverage >= 60) color = 'yellow';
  else if (coverage >= 50) color = 'orange';

  // Update the coverage badge
  const badgeRegex = /\[!\[Coverage\]\(https:\/\/img\.shields\.io\/badge\/coverage-[\d.]+%25-[a-z]+\.svg\)\]\([^)]+\)/;
  const newBadge = `[![Coverage](https://img.shields.io/badge/coverage-${coverage}%25-${color}.svg)](https://github.com/balanced-k-groups/balanced-k-groups)`;
  
  if (badgeRegex.test(readme)) {
    readme = readme.replace(badgeRegex, newBadge);
  } else {
    // If no existing badge, add it after the title
    const titleRegex = /^(# balanced-k-groups)$/m;
    readme = readme.replace(titleRegex, `$1\n\n${newBadge}`);
  }

  fs.writeFileSync(readmePath, readme);
  return true;
}

function main() {
  console.log('Updating coverage badge...');
  
  const coverage = getCoveragePercentage();
  
  if (coverage === null) {
    console.error('Could not determine coverage percentage');
    console.log('Make sure to run "npm run test:coverage" first');
    process.exit(1);
  }

  console.log(`Coverage: ${coverage}%`);

  if (updateReadmeBadge(coverage)) {
    console.log('✅ Coverage badge updated in README.md');
  } else {
    console.error('❌ Failed to update README.md');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getCoveragePercentage, updateReadmeBadge };
