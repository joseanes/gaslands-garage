// PrintService-new.ts - A completely different approach
import type { Draft } from '$lib/draft/io';
import { draftToDataURL } from '$lib/draft/qr';

/**
 * Checks if rules acknowledgment is required before printing
 */
export function checkRulesAcknowledgment(
  actionType: string,
  hasRules: boolean,
  showRulesModal: (action: string) => void
): boolean {
  // If user has acknowledged rules, proceed
  if (hasRules) {
    return true;
  }
  
  // Otherwise, show rules acknowledgment modal
  showRulesModal(actionType);
  return false;
}

/**
 * Generates a printable HTML string from the data
 */
export function generatePrintableHtml(data: {
  teamName: string;
  totalCans: number;
  maxCans: number;
  sponsorName: string;
  vehicles: any[];
  sponsor?: any;
  sponsorPerks?: any;
  qrCode?: string;
  showEquipmentDescriptions?: boolean;
  showPerkDescriptions?: boolean;
}): string {
  const {
    teamName,
    totalCans,
    maxCans,
    sponsorName,
    vehicles,
    sponsor,
    sponsorPerks,
    qrCode,
    showEquipmentDescriptions = true,
    showPerkDescriptions = true
  } = data;
  
  // Check if vehicles exist
  if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
    console.error("[PrintService-new] No vehicles data in generatePrintableHtml:", data);
  }
  
  console.log("[PrintService-new] Generating HTML for vehicles:", vehicles);
  
  // Generate vehicle cards HTML
  let vehicleCardsHtml = '';
  if (vehicles && Array.isArray(vehicles)) {
    vehicles.forEach((vehicle, index) => {
      console.log(`[PrintService-new] Processing vehicle ${index}:`, vehicle);
      vehicleCardsHtml += generateVehicleCardHtml(vehicle);
    });
  } else {
    vehicleCardsHtml = '<div class="vehicle-card">No vehicles found</div>';
  }
  
  // Generate sponsor perks HTML
  let sponsorPerksHtml = '';
  if (sponsorPerks && sponsor) {
    // First show the sponsor's perks classes
    const perksClasses = sponsorPerks.perksClasses || [];
    if (perksClasses.length > 0) {
      sponsorPerksHtml += `
      <div class="sponsor-perks-section">
        <h3>${sponsorName} Perk Classes</h3>
        <p>${perksClasses.join(', ')}</p>
      </div>`;
    }

    // Then show the class perks
    const classPerksList = sponsorPerks.classPerksList || [];
    // Filter perkClasses to only show those purchased by vehicles
    const purchasedPerkClasses = new Set();
    if (vehicles && Array.isArray(vehicles)) {
      vehicles.forEach(vehicle => {
        if (vehicle.perkObjects) {
          vehicle.perkObjects.forEach((perk: any) => {
            if (perk && perk.id) {
              // Add the perk to the purchased list
              purchasedPerkClasses.add(perk.id);
            }
          });
        }
      });
    }

    // Filter to only show purchased perks
    const filteredClassPerksList = classPerksList.filter(perk => {
      if (perk && perk.id) {
        return purchasedPerkClasses.has(perk.id);
      }
      return false;
    });

    if (filteredClassPerksList.length > 0) {
      sponsorPerksHtml += `
      <div class="sponsor-perks-section">
        <h3>Purchased Perk Classes</h3>
        <ul class="perks-list">`;

      filteredClassPerksList.forEach((perk: any) => {
        if (perk && perk.name) {
          sponsorPerksHtml += `
          <li>
            <div class="perk-name">${perk.name} ${perk.level ? `(Level ${perk.level})` : ''}</div>
            <div class="perk-text">${perk.text || ''}</div>
          </li>`;
        }
      });

      sponsorPerksHtml += `
        </ul>
      </div>`;
    }

    // Finally show the sponsor-specific perks
    const sponsorPerksList = sponsorPerks.sponsorPerksList || [];
    if (sponsorPerksList.length > 0) {
      sponsorPerksHtml += `
      <div class="sponsor-perks-section">
        <h3>${sponsorName} Specific Perks</h3>
        <ul class="perks-list">`;

      sponsorPerksList.forEach((perk: any) => {
        if (perk && perk.name) {
          sponsorPerksHtml += `
          <li>
            <div class="perk-name">${perk.name} ${perk.level ? `(Level ${perk.level})` : ''}</div>
            <div class="perk-text">${perk.text || ''}</div>
          </li>`;
        }
      });

      sponsorPerksHtml += `
        </ul>
      </div>`;
    }
  }

  // Generate equipment descriptions HTML (weapons and upgrades)
  let equipmentDescriptionsHtml = '';
  if (showEquipmentDescriptions && vehicles && Array.isArray(vehicles)) {
    // Collect all weapons and upgrades across vehicles
    const allWeapons = new Map();
    const allUpgrades = new Map();

    vehicles.forEach(vehicle => {
      // Add weapons
      if (vehicle.weaponObjects && Array.isArray(vehicle.weaponObjects)) {
        vehicle.weaponObjects.forEach(weapon => {
          if (weapon && weapon.id && weapon.name) {
            allWeapons.set(weapon.id, weapon);
          }
        });
      }

      // Add upgrades
      if (vehicle.upgradeObjects && Array.isArray(vehicle.upgradeObjects)) {
        vehicle.upgradeObjects.forEach(upgrade => {
          if (upgrade && upgrade.id && upgrade.name) {
            allUpgrades.set(upgrade.id, upgrade);
          }
        });
      }
    });

    // Generate weapons section
    if (allWeapons.size > 0) {
      equipmentDescriptionsHtml += `
      <div class="equipment-section">
        <h3>Weapons</h3>
        <ul class="equipment-list">`;

      Array.from(allWeapons.values()).forEach(weapon => {
        equipmentDescriptionsHtml += `
        <li>
          <div class="equipment-name">${weapon.name}</div>
          <div class="equipment-details">
            <span class="equipment-stat">Cost: ${weapon.cost} cans</span>
            <span class="equipment-stat">Attack Dice: ${weapon.attackDice !== '-' ? weapon.attackDice : 'N/A'}</span>
            <span class="equipment-stat">Default Facing: ${weapon.facing || 'Front'}</span>
            ${weapon.specialRules ? `<div class="equipment-rules">${weapon.specialRules}</div>` : ''}
          </div>
        </li>`;
      });

      equipmentDescriptionsHtml += `
        </ul>
      </div>`;
    }

    // Generate upgrades section
    if (allUpgrades.size > 0) {
      equipmentDescriptionsHtml += `
      <div class="equipment-section">
        <h3>Upgrades</h3>
        <ul class="equipment-list">`;

      Array.from(allUpgrades.values()).forEach(upgrade => {
        equipmentDescriptionsHtml += `
        <li>
          <div class="equipment-name">${upgrade.name}</div>
          <div class="equipment-details">
            <span class="equipment-stat">Cost: ${upgrade.cost} cans</span>
            ${upgrade.specialRules ? `<div class="equipment-rules">${upgrade.specialRules}</div>` : ''}
          </div>
        </li>`;
      });

      equipmentDescriptionsHtml += `
        </ul>
      </div>`;
    }
  }
  
  // Generate complete HTML
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Gaslands Team: ${teamName}</title>
    <meta charset="utf-8">
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 20px;
        color: black;
        background-color: white;
      }

      /* Print-specific page settings */
      @media print {
        @page {
          size: auto;
          margin: 10mm;
        }

        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }

      /* Header styles */
      .print-header {
        margin-bottom: 20px;
        border-bottom: 2px solid #d97706;
        padding-bottom: 10px;
      }

      h1 {
        color: #d97706;
        font-size: 24px;
        margin: 0 0 10px 0;
      }

      h2, h3 {
        color: #d97706;
        margin-top: 20px;
        margin-bottom: 10px;
      }

      .team-info {
        display: flex;
        justify-content: space-between;
      }

      /* Vehicle card grid */
      .vehicle-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }

      /* Individual vehicle card */
      .vehicle-card {
        border: 1px solid #888;
        border-radius: 8px;
        padding: 15px;
        page-break-inside: avoid;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
      }

      .vehicle-name {
        font-weight: bold;
        font-size: 1.2em;
      }

      .vehicle-type {
        display: inline-block;
        background-color: #333 !important;
        color: white !important;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.8em;
      }

      .vehicle-cost {
        background-color: black !important;
        color: white !important;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: bold;
        text-align: center;
      }

      /* Stats section */
      .stats-section {
        margin-bottom: 15px;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }

      .stat-item {
        text-align: center;
      }

      .stat-label {
        font-size: 0.8em;
        display: block;
        margin-bottom: 2px;
      }

      .stat-value {
        font-weight: bold;
      }

      /* Hull tracker */
      .hull-track {
        margin-bottom: 15px;
      }

      .hull-boxes {
        display: flex;
        gap: 2px;
      }

      .hull-box {
        width: 15px;
        height: 15px;
        border: 1px solid black;
      }

      /* Loadout sections */
      .loadout-section {
        margin-bottom: 10px;
      }

      .section-title {
        font-weight: bold;
        margin-bottom: 5px;
        border-bottom: 1px solid #eee;
      }

      ul {
        margin: 0;
        padding-left: 20px;
      }

      li {
        margin-bottom: 2px;
      }

      /* Equipment section */
      .equipment-container {
        margin-top: 30px;
        page-break-before: always;
        border-top: 2px solid #d97706;
        padding-top: 20px;
      }

      .equipment-section {
        margin-bottom: 20px;
      }

      .equipment-list {
        list-style-type: disc;
        padding-left: 20px;
      }

      .equipment-name {
        font-weight: bold;
      }

      .equipment-details {
        margin-top: 3px;
        margin-bottom: 8px;
        font-size: 0.9em;
      }

      .equipment-stat {
        display: inline-block;
        background-color: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
        margin-right: 8px;
        margin-bottom: 4px;
        font-size: 0.8em;
      }

      .equipment-rules {
        margin-top: 4px;
        font-size: 0.9em;
        color: #444;
      }

      /* Sponsor perks section */
      .sponsor-perks-container {
        margin-top: 30px;
        page-break-before: always;
        border-top: 2px solid #d97706;
        padding-top: 20px;
      }

      .sponsor-perks-section {
        margin-bottom: 20px;
      }

      .perks-list {
        list-style-type: disc;
        padding-left: 20px;
      }

      .perk-name {
        font-weight: bold;
      }

      .perk-text {
        margin-top: 3px;
        margin-bottom: 8px;
        font-size: 0.9em;
      }

      /* Footer section with QR code */
      .print-footer-container {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #d97706;
        display: flex;
        justify-content: space-between;
        align-items: center;
        page-break-before: auto;
        page-break-inside: avoid;
      }

      /* QR code section */
      .qr-section {
        text-align: center;
      }

      .qr-code {
        max-width: 120px;
        height: auto;
        margin: 0 auto;
        display: block;
      }

      .qr-caption {
        margin-top: 6px;
        font-size: 0.9em;
        color: #666;
      }

      /* Footer */
      .print-footer {
        font-size: 0.8em;
        color: #666;
        flex-grow: 1;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <!-- Header Section -->
    <div class="print-header">
      <h1>${teamName}</h1>
      <div class="team-info">
        <div>Total: ${totalCans} / ${maxCans} cans</div>
        <div>Sponsor: ${sponsorName}</div>
      </div>
    </div>

    <!-- Vehicle Cards Section -->
    <div class="vehicle-cards">
      ${vehicleCardsHtml}
    </div>

    <!-- Equipment Descriptions Section -->
    ${showEquipmentDescriptions && equipmentDescriptionsHtml ? `
    <div class="equipment-container">
      <h2>Equipment Descriptions</h2>
      ${equipmentDescriptionsHtml}
    </div>
    ` : ''}

    <!-- Perk Descriptions Section -->
    ${showPerkDescriptions && sponsorPerksHtml ? `
    <div class="sponsor-perks-container">
      <h2>Perk Descriptions</h2>
      ${sponsorPerksHtml}
    </div>
    ` : ''}

    <!-- Footer Section with QR Code -->
    <div class="print-footer-container">
      <div class="print-footer">
        Generated by <a href="https://www.GaslandsGarage.com" target="_blank" style="color: #d97706; text-decoration: underline;">GaslandsGarage.com</a> on ${new Date().toLocaleDateString()}
      </div>

      <div class="qr-section">
        ${qrCode ?
          `<img src="${qrCode}" class="qr-code" alt="QR Code for team" style="width:120px; height:120px; border:1px solid #000; background:#fff;">` :
          `<div style="width:120px; height:120px; border:1px solid #000; background:#fff; text-align:center; line-height:120px; font-size:10px;">
            Visit gaslandsgarage.com
          </div>`
        }
        <div class="qr-caption">Scan to load this team build</div>
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Generate HTML for a vehicle card
 */
function generateVehicleCardHtml(vehicle: any): string {
  console.log("[PrintService-new] Generating HTML for vehicle:", vehicle);
  
  // Check if vehicle data is valid
  if (!vehicle) {
    console.error("[PrintService-new] Invalid vehicle data:", vehicle);
    return '<div class="vehicle-card">Error: Invalid vehicle data</div>';
  }
  
  try {
    // Extract needed data with defensive coding
    const id = vehicle.id || 'v-' + Math.random().toString(36).substring(2, 9);
    const name = vehicle.name || 'Vehicle';
    const type = vehicle.type || 'car';
    const vehicleType = vehicle.vehicleType || {};
    const stats = vehicle.stats || {};
    const cost = vehicle.cost || 0;
    
    // Use either weaponObjects (new enhanced format) or fall back to weapons array
    const weaponObjects = Array.isArray(vehicle.weaponObjects) ? vehicle.weaponObjects : [];
    const upgradeObjects = Array.isArray(vehicle.upgradeObjects) ? vehicle.upgradeObjects : [];
    const perkObjects = Array.isArray(vehicle.perkObjects) ? vehicle.perkObjects : [];
    
    // Generate hull boxes HTML
    const hull = stats.hull || 4;
    let hullBoxesHtml = '';
    for (let i = 0; i < hull; i++) {
      hullBoxesHtml += '<div class="hull-box"></div>';
    }
    
    // Generate weapons HTML using weaponObjects if available
    let weaponsHtml = '';
    if (weaponObjects.length > 0) {
      weaponsHtml = '<div class="loadout-section"><div class="section-title">Weapons</div><ul>';
      
      weaponObjects.forEach((weapon: any) => {
        const weaponName = weapon.name || 'Unknown Weapon';
        const facing = weapon.facing || 'front';
        const attackDice = weapon.attackDice || '-';
        
        weaponsHtml += `<li>${weaponName} (${facing}) ${attackDice !== '-' ? attackDice + 'D' : ''}</li>`;
      });
      
      weaponsHtml += '</ul></div>';
    } else if (Array.isArray(vehicle.weapons) && vehicle.weapons.length > 0) {
      // Fallback to the old weapons array if weaponObjects not available
      weaponsHtml = '<div class="loadout-section"><div class="section-title">Weapons</div><ul>';
      
      vehicle.weapons.forEach((weapon: any) => {
        let weaponName = '';
        
        if (typeof weapon === 'string') {
          weaponName = weapon;
        } else if (weapon && typeof weapon === 'object') {
          weaponName = weapon.name || 'Unknown Weapon';
        } else {
          weaponName = 'Unknown Weapon';
        }
        
        weaponsHtml += `<li>${weaponName}</li>`;
      });
      
      weaponsHtml += '</ul></div>';
    }
    
    // Generate upgrades HTML using upgradeObjects if available
    let upgradesHtml = '';
    if (upgradeObjects.length > 0) {
      upgradesHtml = '<div class="loadout-section"><div class="section-title">Upgrades</div><ul>';
      
      upgradeObjects.forEach((upgrade: any) => {
        const upgradeName = upgrade.name || 'Unknown Upgrade';
        upgradesHtml += `<li>${upgradeName}</li>`;
      });
      
      upgradesHtml += '</ul></div>';
    } else if (Array.isArray(vehicle.upgrades) && vehicle.upgrades.length > 0) {
      // Fallback to the old upgrades array if upgradeObjects not available
      upgradesHtml = '<div class="loadout-section"><div class="section-title">Upgrades</div><ul>';
      
      vehicle.upgrades.forEach((upgrade: any) => {
        let upgradeName = '';
        
        if (typeof upgrade === 'string') {
          upgradeName = upgrade;
        } else if (upgrade && typeof upgrade === 'object') {
          upgradeName = upgrade.name || 'Unknown Upgrade';
        } else {
          upgradeName = 'Unknown Upgrade';
        }
        
        upgradesHtml += `<li>${upgradeName}</li>`;
      });
      
      upgradesHtml += '</ul></div>';
    }
    
    // Generate perks HTML using perkObjects if available
    let perksHtml = '';
    if (perkObjects.length > 0) {
      perksHtml = '<div class="loadout-section"><div class="section-title">Perks</div><ul>';
      
      perkObjects.forEach((perk: any) => {
        const perkName = perk.name || 'Unknown Perk';
        const level = perk.level || 1;
        perksHtml += `<li>${perkName} ${level > 1 ? `(Level ${level})` : ''}</li>`;
      });
      
      perksHtml += '</ul></div>';
    } else if (Array.isArray(vehicle.perks) && vehicle.perks.length > 0) {
      // Fallback to the old perks array if perkObjects not available
      perksHtml = '<div class="loadout-section"><div class="section-title">Perks</div><ul>';
      
      vehicle.perks.forEach((perk: any) => {
        let perkName = '';
        
        if (typeof perk === 'string') {
          perkName = perk;
        } else if (perk && typeof perk === 'object') {
          perkName = perk.name || 'Unknown Perk';
        } else {
          perkName = 'Unknown Perk';
        }
        
        perksHtml += `<li>${perkName}</li>`;
      });
      
      perksHtml += '</ul></div>';
    }
    
    // Handle vehicle type display
    let vehicleTypeName = 'Car';
    
    if (vehicleType && typeof vehicleType === 'object' && vehicleType.name) {
      vehicleTypeName = vehicleType.name;
    } else if (typeof type === 'string') {
      vehicleTypeName = type.charAt(0).toUpperCase() + type.slice(1);
    }
    
    // Get stats with fallbacks
    const handling = stats.handling || vehicleType.handling || 4;
    const gear = stats.gear || vehicleType.maxGear || 6;
    const crew = stats.crew || vehicleType.crew || 1;
    const weight = getWeightText(stats.weight || vehicleType.weight || 2);
    
    // Return complete vehicle card HTML
    return `
    <div class="vehicle-card">
      <div class="card-header">
        <div>
          <div class="vehicle-name">${name}</div>
          <div class="vehicle-type">${vehicleTypeName}</div>
        </div>
        <div class="vehicle-cost">${cost} cans</div>
      </div>
      
      <div class="hull-track">
        <div class="stat-label">Hull</div>
        <div class="hull-boxes">${hullBoxesHtml}</div>
      </div>
      
      <div class="stats-section">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Handling</span>
            <span class="stat-value">${handling}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Gear</span>
            <span class="stat-value">${gear}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Crew</span>
            <span class="stat-value">${crew}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Weight</span>
            <span class="stat-value">${weight}</span>
          </div>
        </div>
      </div>
      
      ${weaponsHtml}
      ${upgradesHtml}
      ${perksHtml}
    </div>
    `;
  } catch (error) {
    console.error("[PrintService-new] Error generating vehicle card HTML:", error);
    return `<div class="vehicle-card">Error generating vehicle card: ${error.message}</div>`;
  }
}

/**
 * Convert weight number to text
 */
function getWeightText(weight: number): string {
  switch(weight) {
    case 1: return 'Light';
    case 2: return 'Medium';
    case 3: return 'Heavy';
    case 4: return 'Massive';
    default: return 'Medium';
  }
}

/**
 * Main print function that generates and opens printable content in a new window
 */
export async function printTeam(printStyle: string, draft: Draft): Promise<void> {
  console.log("[PrintService-new] printTeam called", { printStyle, draft });

  try {
    // Dump the draft data to console to debug vehicle data
    console.log("[PrintService-new] Print data:", JSON.stringify(draft, null, 2));

    // Generate QR code
    let qrCode = null;
    try {
      // If the draft already has a QR code, use it
      if (draft.qrCode && typeof draft.qrCode === 'string' && draft.qrCode.startsWith('data:image/')) {
        console.log("[PrintService-new] Using provided QR code from draft");
        qrCode = draft.qrCode;
      } else {
        // Generate a new QR code
        console.log("[PrintService-new] Generating new QR code for draft");

        // Create a simplified version of the draft to encode
        const simpleDraft = {
          sponsor: draft.sponsor?.id || 'no_sponsor',
          teamName: draft.teamName || 'Gaslands Team',
          vehicles: draft.vehicles.map(v => ({
            id: v.id,
            type: v.type,
            name: v.name,
            weapons: v.weapons,
            upgrades: v.upgrades,
            perks: v.perks,
            weaponFacings: v.weaponFacings
          }))
        };

        // Generate the QR code using the simplified draft
        qrCode = await draftToDataURL(simpleDraft);
        console.log("[PrintService-new] QR code generated, length:", qrCode?.length || 0);
      }

      // Final validation
      if (!qrCode || typeof qrCode !== 'string' || !qrCode.startsWith('data:image/')) {
        console.error("[PrintService-new] Invalid QR code generated:", qrCode?.substring(0, 30));
        qrCode = null;
      }
    } catch (qrError) {
      console.error("[PrintService-new] Error generating QR code:", qrError);
      qrCode = null;
    }

    // Check if vehicles array exists
    if (!draft.vehicles || !Array.isArray(draft.vehicles) || draft.vehicles.length === 0) {
      console.error("[PrintService-new] No vehicles found in draft data", draft);
      alert('No vehicles found to print. Please add vehicles to your team.');
      return;
    }

    // Determine if we should include equipment and perk descriptions
    const showEquipmentDescriptions = draft.showEquipmentDescriptions !== undefined ?
      draft.showEquipmentDescriptions : true;

    const showPerkDescriptions = draft.showPerkDescriptions !== undefined ?
      draft.showPerkDescriptions : true;

    console.log("[PrintService-new] Print options:", {
      showEquipmentDescriptions,
      showPerkDescriptions,
      printStyle
    });

    // Collect data for printing
    const printData = {
      teamName: draft.teamName || 'Gaslands Team',
      totalCans: draft.totalCans || 0,
      maxCans: draft.maxCans || 50,
      sponsorName: draft.sponsorName || 'No Sponsor',
      sponsor: draft.sponsor || null,
      sponsorPerks: showPerkDescriptions ? (draft.sponsorPerks || null) : null,
      vehicles: draft.vehicles,
      qrCode: qrCode,
      showEquipmentDescriptions: showEquipmentDescriptions,
      showPerkDescriptions: showPerkDescriptions
    };
    
    // Generate printable HTML
    const printHtml = generatePrintableHtml(printData);
    
    // Log the HTML for debugging
    console.log("[PrintService-new] Generated HTML length:", printHtml.length);
    
    // Open a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      console.error("[PrintService-new] Failed to open print window");
      alert('Please allow popups to print your team');
      return;
    }
    
    // Write HTML to print window
    printWindow.document.write(printHtml);
    printWindow.document.close();
    
    // Debug the new window
    console.log("[PrintService-new] Created print window with document length:", 
      printWindow.document.documentElement.innerHTML.length);
    
    // Check for vehicle cards in the new window
    const vehicleCards = printWindow.document.querySelectorAll('.vehicle-card');
    console.log("[PrintService-new] Vehicle cards in print window:", vehicleCards.length);
    
    // Print after a delay to ensure content is loaded
    setTimeout(() => {
      try {
        // Double check vehicle cards are present
        const vehicleCardsCheck = printWindow.document.querySelectorAll('.vehicle-card');
        console.log("[PrintService-new] Vehicle cards before printing:", vehicleCardsCheck.length);
        
        // Add close button to the print window
        const closeButton = printWindow.document.createElement('button');
        closeButton.innerHTML = 'Close Window';
        closeButton.style.position = 'fixed';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.padding = '8px 16px';
        closeButton.style.backgroundColor = '#d97706';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.zIndex = '1000';
        closeButton.style.fontWeight = 'bold';
        
        // Add event listener to close button
        closeButton.addEventListener('click', function() {
          printWindow.close();
        });
        
        // Add a print button as well
        const printButton = printWindow.document.createElement('button');
        printButton.innerHTML = 'Print';
        printButton.style.position = 'fixed';
        printButton.style.top = '10px';
        printButton.style.right = '140px'; // Position next to close button
        printButton.style.padding = '8px 16px';
        printButton.style.backgroundColor = '#2563eb'; // Blue
        printButton.style.color = 'white';
        printButton.style.border = 'none';
        printButton.style.borderRadius = '4px';
        printButton.style.cursor = 'pointer';
        printButton.style.zIndex = '1000';
        printButton.style.fontWeight = 'bold';
        
        // Add event listener to print button
        printButton.addEventListener('click', function() {
          printWindow.print();
        });
        
        // Add a button to open print settings
        const settingsButton = printWindow.document.createElement('button');
        settingsButton.innerHTML = 'Change Print Settings';
        settingsButton.style.position = 'fixed';
        settingsButton.style.top = '10px';
        settingsButton.style.right = '140px'; // Position between print and close
        settingsButton.style.padding = '8px 16px';
        settingsButton.style.backgroundColor = '#047857'; // Green
        settingsButton.style.color = 'white';
        settingsButton.style.border = 'none';
        settingsButton.style.borderRadius = '4px';
        settingsButton.style.cursor = 'pointer';
        settingsButton.style.zIndex = '1000';
        settingsButton.style.fontWeight = 'bold';

        // Add event listener to settings button - close this window and open print settings
        settingsButton.addEventListener('click', function() {
            // The most direct approach - set a local storage item that the main window will check
            try {
                // Create a timestamp to ensure the event is detected
                const timestamp = new Date().getTime();
                localStorage.setItem('openPrintSettings', timestamp.toString());
                console.log("Set localStorage flag to open print settings");
                
                // Also try to call the function directly if available
                if (window.opener && typeof window.opener.openSettings === 'function') {
                    try {
                        window.opener.openSettings('print');
                    } catch (e) {
                        console.error("Error calling openSettings directly:", e);
                    }
                }
            } catch (err) {
                console.error("Error setting localStorage:", err);
            }
            
            // Close the print window
            printWindow.close();
        });

        /* MAIL BUTTON - TEMPORARILY DISABLED
        // Add a mail button to email the page
        const mailButton = printWindow.document.createElement('button');
        mailButton.innerHTML = 'Mail this printout';
        mailButton.style.position = 'fixed';
        mailButton.style.top = '10px';
        mailButton.style.right = '560px'; // Leftmost button
        mailButton.style.padding = '8px 16px';
        mailButton.style.backgroundColor = '#6366f1'; // Indigo
        mailButton.style.color = 'white';
        mailButton.style.border = 'none';
        mailButton.style.borderRadius = '4px';
        mailButton.style.cursor = 'pointer';
        mailButton.style.zIndex = '1000';
        mailButton.style.fontWeight = 'bold';
        
        // Add event listener to mail button
        mailButton.addEventListener('click', function() {
            // Create mail body with team info
            const teamName = draft.teamName || 'Gaslands Team';
            const sponsor = draft.sponsorName || 'No Sponsor';
            const mailSubject = `Gaslands Team: ${teamName} (${sponsor})`;
            const mailBody = `Check out my Gaslands team:\n\n${teamName}\nSponsor: ${sponsor}\nTotal: ${draft.totalCans || 0}/${draft.maxCans || 50} cans\n\nCreate your own team at https://www.GaslandsGarage.com`;
            
            // Open default mail client
            window.location.href = `mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
        });
        */

        // Update button positions to avoid overlapping
        // Mail button is disabled for now
        printButton.style.right = '320px'; // Left button - more space to avoid overlap
        settingsButton.style.right = '140px'; // Middle button 
        closeButton.style.right = '10px'; // Right button

        // Add elements to the document
        printWindow.document.body.insertBefore(closeButton, printWindow.document.body.firstChild);
        printWindow.document.body.insertBefore(settingsButton, printWindow.document.body.firstChild);
        printWindow.document.body.insertBefore(printButton, printWindow.document.body.firstChild);
        // Mail button is disabled for now
        // printWindow.document.body.insertBefore(mailButton, printWindow.document.body.firstChild);
        
        // Print the window - this will open the print dialog
        printWindow.print();
        
        // We no longer automatically close the window
        // User must close it manually with the close button
      } catch (printError) {
        console.error("[PrintService-new] Error during printing:", printError);
        alert('Error during printing. Please try again.');
      }
    }, 1000); // Increased timeout for content loading
    
  } catch (error) {
    console.error("[PrintService-new] Error in printTeam:", error);
    alert('There was an error preparing for printing. Please try again.');
  }
}

/**
 * Wrapper function for printing with rules check
 */
export function printWithRulesCheck(
  printStyle: string,
  draft: Draft,
  hasRules: boolean,
  showRulesModal: (action: string) => void
): void {
  if (checkRulesAcknowledgment('printTeam', hasRules, showRulesModal)) {
    printTeam(printStyle, draft);
  }
}