# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gaslands Garage is a web application for creating, validating, and sharing vehicle teams for the Gaslands tabletop game. The application allows users to:

- Select a sponsor faction
- Add vehicles to their team
- Customize vehicles with weapons and perks
- Validate team builds against game rules
- Share builds via encoded links or QR codes

## Repository Structure

- `/app`: Svelte-based web application frontend
  - `/src/data/rules`: Game rule definitions (vehicles, weapons, perks, sponsors)
  - `/src/lib/draft`: Functions for encoding/decoding team builds
  - `/src/lib/rules`: Types and loaders for game rules
  - `/src/lib/validate`: Validation logic for team builds
  - `/src/routes`: Svelte routes and components
- `/infra`: AWS CDK infrastructure for deployment
- `/validate`: Core validation logic (shared)

## Commands

### Development

```bash
# Install dependencies for all packages
pnpm install

# Start development server (from app directory)
cd app && pnpm dev

# Start development server with browser open
cd app && pnpm dev -- --open

# Type checking
cd app && pnpm check

# Watch mode type checking
cd app && pnpm check:watch
```

### Building and Deployment

```bash
# Build the application
cd app && pnpm build

# Preview the production build
cd app && pnpm preview

# Build the infrastructure
cd infra && pnpm build

# Deploy the infrastructure to AWS
cd infra && npx cdk deploy

# Compare deployed stack with current state
cd infra && npx cdk diff
```

## Architecture

The application uses:

1. **Svelte/SvelteKit** for the frontend UI
2. **Zod** for data validation and type checking
3. **Tailwind CSS** for styling
4. **AWS CDK** for infrastructure deployment

Key components:

- **Rules Data**: JSON files define game rules (vehicles.json, weapons.json, perks.json, sponsor/*.json)
- **Validation Logic**: Functions to validate team builds against game rules
- **Draft Encoding**: Functions to encode/decode team builds for sharing (via URLs or QR codes)
- **Builder UI**: Svelte components for the team builder interface

Data flow:
1. User selects sponsor and adds vehicles with weapons/perks
2. Frontend validates build using the validation logic
3. Builds can be exported as encoded strings and shared via URL or QR code

## Important Files

- `app/src/routes/builder/+page.svelte`: Main team builder UI
- `app/src/lib/validate/index.ts`: Core validation logic
- `app/src/data/rules/*.json`: Game rule definitions
- `app/src/lib/draft/io.ts`: Draft encoding/decoding functions