# Validation Tests

This directory contains unit tests for the validation system.

## Files

- `validate.test.ts` - Tests for the main validation function
- `checks.test.ts` - Tests for validation check functions
- `calc.test.ts` - Tests for the calculation utility functions
- `mockData.ts` - Mock game data for testing
- `mockLoadRules.ts` - Mock functions for loading game rules

## Running Tests

From the app directory:

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:coverage

# Run tests in watch mode during development
pnpm test:watch
```

## Coverage

Current test coverage for the validation module is over 90%.

## Adding New Tests

When adding new tests:

1. Add appropriate mock data to `mockData.ts`
2. Create test cases that verify:
   - Success cases
   - Validation failures
   - Edge cases
   - Error handling
3. Run the tests to verify they pass

## Test Structure

Tests follow this structure:

1. Setup mock data and functions
2. Execute the code being tested
3. Verify the results match expectations
4. Cleanup any resources (when needed)