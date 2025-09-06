# Coverage and Badge Management

This document explains how to manage test coverage and update the coverage badge in the README.

## Overview

The project includes automated coverage reporting and badge management to maintain visibility of test coverage quality.

## Scripts

### `npm run test:coverage`
Runs all tests with coverage reporting and generates HTML, JSON, and text reports in the `coverage/` directory.

### `npm run test:coverage:ci`
Runs tests with coverage in CI mode, generating both verbose output and a JSON summary file for automated processing.

### `npm run coverage:report`
Generates a coverage report and displays a confirmation message.

### `npm run coverage:badge`
Runs coverage tests and automatically updates the coverage badge in README.md with the latest percentage and appropriate color.

## Coverage Badge

The coverage badge is automatically updated based on the latest test results:

- **Green (brightgreen)**: ≥90% coverage
- **Green**: ≥80% coverage  
- **Yellow-green**: ≥70% coverage
- **Yellow**: ≥60% coverage
- **Orange**: ≥50% coverage
- **Red**: <50% coverage

## Configuration

### Vitest Configuration
Coverage settings are configured in `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'json-summary'],
  reportsDirectory: './coverage',
  exclude: [
    'node_modules/',
    'dist/',
    'tests/',
    'bench/',
    'scripts/',
    '**/*.d.ts',
    '**/*.config.*',
    '**/*.spec.ts',
    '**/*.test.ts'
  ],
  include: ['src/**/*.ts'],
  thresholds: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
}
```

### Coverage Thresholds
The project enforces minimum coverage thresholds:
- **Branches**: 80%
- **Functions**: 90%
- **Lines**: 90%
- **Statements**: 90%

## Automated Updates

### Pre-publish Hook
The `prepublishOnly` script automatically runs coverage tests before publishing:

```json
"prepublishOnly": "npm run build && npm run test:coverage"
```

### CI/CD Integration
For CI/CD pipelines, use:

```bash
npm run coverage:badge
```

This will:
1. Run tests with coverage
2. Generate coverage reports
3. Update the README badge automatically

## Manual Badge Update

To manually update the badge without running tests:

```bash
node scripts/update-coverage-badge.js
```

## Coverage Reports

After running coverage tests, you can find:

- **HTML Report**: `coverage/index.html` - Interactive coverage report
- **JSON Summary**: `coverage/coverage-summary.json` - Machine-readable summary
- **JSON Details**: `coverage/coverage-final.json` - Detailed coverage data
- **Text Report**: Console output with coverage summary

## Best Practices

1. **Run coverage before commits**: Ensure new code doesn't decrease coverage
2. **Update badge after significant changes**: Keep the README badge current
3. **Monitor thresholds**: The build will fail if coverage drops below thresholds
4. **Review uncovered lines**: Use the HTML report to identify untested code paths

## Troubleshooting

### Badge Not Updating
- Ensure coverage tests have been run recently
- Check that `coverage/coverage-summary.json` exists
- Verify the script has execute permissions: `chmod +x scripts/update-coverage-badge.js`

### Coverage Threshold Failures
- Review the coverage report to identify uncovered code
- Add tests for uncovered branches and functions
- Consider if uncovered code is actually needed

### Script Errors
- Ensure Node.js ≥16 is installed
- Check that all dependencies are installed: `npm install`
- Verify file permissions and paths
