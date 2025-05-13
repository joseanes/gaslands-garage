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
}): string {
  const { teamName, totalCans, maxCans, sponsorName, vehicles, sponsor, sponsorPerks, qrCode } = data;
  
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
    if (classPerksList.length > 0) {
      sponsorPerksHtml += `
      <div class="sponsor-perks-section">
        <h3>Perk Classes</h3>
        <ul class="perks-list">`;
        
      classPerksList.forEach((perk: any) => {
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
      
      /* QR code section */
      .qr-section {
        text-align: center;
        margin-top: 30px;
        page-break-before: auto;
      }
      
      .qr-code {
        max-width: 150px;
        height: auto;
        margin: 0 auto;
        display: block;
      }
      
      .qr-caption {
        margin-top: 10px;
        font-size: 0.9em;
        color: #666;
      }
      
      /* Footer */
      .print-footer {
        margin-top: 20px;
        text-align: center;
        font-size: 0.8em;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="print-header">
      <h1>${teamName}</h1>
      <div class="team-info">
        <div>Total: ${totalCans} / ${maxCans} cans</div>
        <div>Sponsor: ${sponsorName}</div>
      </div>
    </div>
    
    <div class="vehicle-cards">
      ${vehicleCardsHtml}
    </div>
    
    ${sponsorPerksHtml ? `
    <div class="sponsor-perks-container">
      <h2>Sponsor Perks</h2>
      ${sponsorPerksHtml}
    </div>
    ` : ''}
    
    <div class="qr-section">
      ${qrCode ? `<img src="${qrCode}" class="qr-code" alt="QR Code for team">` : ''}
      <div class="qr-caption">Scan to load this team build</div>
    </div>
    
    <div class="print-footer">
      Generated by Gaslands Garage on ${new Date().toLocaleDateString()}
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
    let qrCode = '';
    try {
      qrCode = await draftToDataURL(draft);
      console.log("[PrintService-new] QR code generated successfully");
    } catch (qrError) {
      console.error("[PrintService-new] Error generating QR code:", qrError);
    }
    
    // Check if vehicles array exists
    if (!draft.vehicles || !Array.isArray(draft.vehicles) || draft.vehicles.length === 0) {
      console.error("[PrintService-new] No vehicles found in draft data", draft);
      alert('No vehicles found to print. Please add vehicles to your team.');
      return;
    }
    
    // Collect data for printing
    const printData = {
      teamName: draft.teamName || 'Gaslands Team',
      totalCans: draft.totalCans || 0,
      maxCans: draft.maxCans || 50,
      sponsorName: draft.sponsorName || 'No Sponsor',
      sponsor: draft.sponsor || null,
      sponsorPerks: draft.sponsorPerks || null,
      vehicles: draft.vehicles,
      qrCode: qrCode
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
        
        // Add a note about how to use the window
        const noteDiv = printWindow.document.createElement('div');
        noteDiv.innerHTML = 'You can print this page using the Print button or close this window when done.';
        noteDiv.style.textAlign = 'center';
        noteDiv.style.marginTop = '10px';
        noteDiv.style.padding = '10px';
        noteDiv.style.backgroundColor = '#f3f4f6';
        noteDiv.style.color = '#374151';
        noteDiv.style.borderRadius = '4px';
        noteDiv.style.fontSize = '14px';
        
        // Add elements to the document
        printWindow.document.body.insertBefore(noteDiv, printWindow.document.body.firstChild);
        printWindow.document.body.insertBefore(closeButton, printWindow.document.body.firstChild);
        printWindow.document.body.insertBefore(printButton, printWindow.document.body.firstChild);
        
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