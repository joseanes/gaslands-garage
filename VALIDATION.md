# Gaslands Garage Validation

This document outlines the validation process for the Gaslands Garage application, specifically focusing on build slots calculation and UI display.

## Build Slots Implementation

Build slots are a core game mechanic in Gaslands. Each vehicle has a maximum number of build slots, and weapons and upgrades consume a specific number of slots. The implementation follows these rules:

1. Each vehicle type has a predefined number of build slots (typically 2-4)
2. Each weapon and upgrade has a build slot cost (typically 1-3)
3. Some special weapons (handguns, molotovs, etc.) are "free" and don't consume build slots
4. The total used slots must not exceed the vehicle's maximum slots

### Build Slots Calculation

The `calculateUsedBuildSlots` function in `builder/+page.svelte` handles this calculation. It:

- Iterates through all weapons on a vehicle
- Identifies the base weapon type (extracting it from the instance ID)
- Adds the appropriate slot cost (unless it's a free weapon)
- Iterates through all upgrades on a vehicle
- Adds the appropriate slot cost for each upgrade
- Returns the total used slots

### Validation

A validation script (`validate-slots.js`) has been created to verify the calculation logic. It includes test cases for:

- Empty vehicles
- Vehicles with standard weapons
- Vehicles with free weapons
- Vehicles with a mix of upgrades and weapons
- Vehicles with multiple weapons and upgrades

## UI Display Implementation

The UI display for build slots has been implemented with these features:

1. A dedicated BuildHeader component that shows:
   - Vehicle cost in cans (amber badge)
   - Used build slots / max build slots (blue badge)

2. This component is used in two places:
   - In the expanded vehicle view (main header)
   - In the collapsed vehicle view (summary)

3. The build slots display updates reactively when:
   - Adding or removing weapons
   - Adding or removing upgrades
   - Changing vehicle type

### Styling Validation

A validation checklist (`validate-styles.js`) has been created for manual UI testing. It covers:

- Visual styling of cost and slots badges
- Layout in different vehicle views
- Consistency between light and dark modes
- Reactivity to vehicle changes

## Testing Process

To validate the implementation:

1. Run `node validate-slots.js` to verify slot calculation logic
2. Run `node validate-styles.js` and use it as a manual testing checklist
3. Start the development server (`pnpm dev`) and test in the browser
4. Test both light and dark modes
5. Test with various vehicle configurations (adding/removing weapons and upgrades)
6. Verify that the build slots display updates correctly

## Future Improvements

Potential future improvements include:

- More sophisticated validation with automated UI tests
- Enhanced visual indicators when approaching or exceeding slot limits
- Tooltips explaining build slot calculations
- Animation effects when slots change