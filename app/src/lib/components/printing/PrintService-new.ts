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
  showSpecialRules?: boolean;
  printStyle?: string;
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
    showPerkDescriptions = true,
    showSpecialRules = true,
    printStyle = 'classic'
  } = data;
  
  // Check if vehicles exist and are valid
  const hasValidVehicles = vehicles && 
    Array.isArray(vehicles) && 
    vehicles.length > 0 &&
    vehicles.some(v => v && typeof v === 'object');
    
  if (!hasValidVehicles) {
    console.error("[PrintService-new] No valid vehicles data in generatePrintableHtml:", data);
  }
  
  console.log("[PrintService-new] Generating HTML for vehicles with style:", printStyle, vehicles);
  
  // Ensure printStyle is a string and handle various dashboard naming conventions
  const style = String(printStyle || 'classic').toLowerCase().trim();
  
  // Check if we should use Dashboard style - handle different naming variations
  console.log("[PrintService-new] Using print style:", style);
  console.log("[PrintService-new] Dashboard style check:", style.includes('dashboard'));
  
  if (style === 'dashboard_v2' || style === 'dashboard' || style.includes('dashboard')) {
    console.log("[PrintService-new] Generating dashboard-style HTML");
    return generateDashboardHtml(data);
  }
  
  console.log("[PrintService-new] Generating classic-style HTML");
  
  // Continue with Classic style
  
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
        <h3>Available Perk Classes</h3>
        <p>${perksClasses.join(', ')}</p>
      </div>`;
    }

    // Then show the class perks
    const classPerksList = sponsorPerks.classPerksList || [];
    // Filter perkClasses to only show those purchased by vehicles
    const purchasedPerkClasses = new Set();
    if (vehicles && Array.isArray(vehicles)) {
      vehicles.forEach(vehicle => {
        // First try perkObjects (enhanced format)
        if (vehicle.perkObjects && Array.isArray(vehicle.perkObjects)) {
          vehicle.perkObjects.forEach((perk: any) => {
            // Try id, or if not available, try name
            if (perk) {
              if (perk.id) {
                purchasedPerkClasses.add(perk.id);
              } else if (perk.name) {
                purchasedPerkClasses.add(perk.name);
              }
            }
          });
        }
        // Fallback to perks array if perkObjects not available
        else if (vehicle.perks && Array.isArray(vehicle.perks)) {
          vehicle.perks.forEach((perk: any) => {
            if (typeof perk === 'string') {
              purchasedPerkClasses.add(perk);
            } else if (perk && perk.id) {
              purchasedPerkClasses.add(perk.id);
            } else if (perk && perk.name) {
              purchasedPerkClasses.add(perk.name);
            }
          });
        }
      });
    }

    // Filter to only show purchased perks
    const filteredClassPerksList = classPerksList.filter(perk => {
      if (perk) {
        // Try to match by id
        if (perk.id && purchasedPerkClasses.has(perk.id)) {
          return true;
        }
        // Try to match by name
        if (perk.name && purchasedPerkClasses.has(perk.name)) {
          return true;
        }
      }
      return false;
    });

    if (filteredClassPerksList.length > 0) {
      sponsorPerksHtml += `
      <div class="sponsor-perks-section">
        <h3>Purchased Perks</h3>
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
        <h3>Sponsor Perks</h3>
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
  
  // Generate complete HTML for Classic style
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
    ${sponsorPerksHtml ? `
    <div class="sponsor-perks-container">
      <h2>Perk Descriptions</h2>
      ${sponsorPerksHtml}
    </div>
    ` : ''}
    
    <!-- Vehicle Special Rules Section -->
    ${showSpecialRules ? `
    <div class="vehicle-rules-container" style="margin-top: 30px; page-break-before: auto; border-top: 2px solid #d97706; padding-top: 20px;">
      <h2 style="color: #d97706; font-size: 24px; margin-bottom: 15px;">Vehicle Special Rules</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr>
            <th style="width: 25%; text-align: left; border-bottom: 2px solid #d97706; padding: 10px; font-size: 16px;">Rule</th>
            <th style="text-align: left; border-bottom: 2px solid #d97706; padding: 10px; font-size: 16px;">Description</th>
          </tr>
        </thead>
        <tbody>
          ${generateVehicleSpecialRulesHtml(vehicles)}
        </tbody>
      </table>
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
 * Generate HTML for Dashboard style printing
 */
function generateDashboardHtml(data: {
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
  showSpecialRules?: boolean;
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
    showPerkDescriptions = true,
    showSpecialRules = true,
    printStyle = 'classic'
  } = data;
  
  // Get sponsor description if available
  let sponsorDescription = '';
  if (sponsor && sponsor.description) {
    sponsorDescription = sponsor.description;
  } else if (sponsorPerks && sponsorPerks.perksClasses) {
    sponsorDescription = sponsorPerks.perksClasses.join(', ');
  }
  
  // Generate vehicle dashboards HTML
  let vehicleDashboardsHtml = '';
  
  if (vehicles && Array.isArray(vehicles)) {
    vehicles.forEach((vehicle, index) => {
      vehicleDashboardsHtml += generateVehicleDashboardHtml(vehicle, sponsorName);
      
      // Add page break after each vehicle except the last one
      if (index < vehicles.length - 1) {
        vehicleDashboardsHtml += '<div class="page-break"></div>';
      }
    });
  } else {
    vehicleDashboardsHtml = '<div class="dashboard-card">No vehicles found</div>';
  }
  
  // Inspect what's in the data for debugging
  console.log("[PrintService-new] Dashboard data:", {
    teamName,
    sponsorName,
    vehiclesLength: vehicles?.length,
    hasQrCode: Boolean(qrCode),
    sponsorPerks: Boolean(sponsorPerks)
  });

  // Generate complete HTML for Dashboard style
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Gaslands Dashboard: ${teamName}</title>
    <meta charset="utf-8">
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 10px;
        color: black;
        background-color: white;
        line-height: 1.2;
      }

      /* Print-specific page settings */
      @media print {
        @page {
          size: auto;
          margin: 5mm;
        }

        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .page-break {
          page-break-after: always;
        }
        
        .print-buttons {
          display: none;
        }
      }
      
      /* Print Control Buttons */
      .print-buttons {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 1000;
        display: flex;
        gap: 10px;
      }
      
      .print-button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-weight: bold;
        cursor: pointer;
        font-size: 14px;
      }
      
      .print-button-print {
        background-color: #2563eb;
        color: white;
      }
      
      .print-button-settings {
        background-color: #047857;
        color: white;
      }
      
      .print-button-close {
        background-color: #d97706;
        color: white;
      }
      
      /* Dashboard-specific styles */
      .sponsor-header {
        border: 1px solid black;
        margin-bottom: 15px;
        padding: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        page-break-inside: avoid;
      }
      
      .sponsor-name {
        font-size: 24px;
        font-weight: bold;
      }
      
      .sponsor-description {
        font-size: 16px;
        font-style: italic;
      }
      
      /* Dashboard Vehicle Card */
      .dashboard-card {
        border: 1px solid black;
        margin-bottom: 15px;
        page-break-inside: avoid;
      }
      
      .vehicle-header {
        font-size: 28px;
        font-weight: bold;
        padding: 10px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      
      .vehicle-subheader {
        font-size: 16px;
        font-weight: normal;
      }
      
      .vehicle-type-perks {
        font-size: 18px;
        font-weight: bold;
        margin-top: 5px;
        margin-bottom: 10px;
      }
      
      .dashboard-stats {
        display: flex;
        justify-content: space-between;
        align-items: stretch;
        margin-top: 5px;
      }
      
      .stat-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        border: 1px solid black;
        padding: 5px;
        width: 80px;
        height: 80px;
      }
      
      .stat-box-label {
        font-size: 16px;
        font-weight: bold;
      }
      
      .stat-box-value {
        font-size: 36px;
        font-weight: bold;
      }
      
      .hull-track {
        margin: 10px 0;
      }
      
      .hull-label {
        font-weight: bold;
        margin-bottom: 5px;
      }
      
      .hull-boxes {
        display: flex;
        gap: 3px;
        flex-wrap: wrap;
      }
      
      .hull-box {
        width: 20px;
        height: 20px;
        border: 1px solid black;
      }
      
      .dashboard-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      
      .dashboard-table th, .dashboard-table td {
        border: 1px solid black;
        padding: 5px;
        text-align: left;
      }
      
      .dashboard-table th {
        background-color: #f0f0f0;
        font-weight: bold;
      }
      
      .dashboard-table td {
        vertical-align: top;
      }
      
      .stat-row {
        display: flex;
        justify-content: space-between;
        margin-top: 10px;
      }
      
      .stat-item {
        font-size: 16px;
        font-weight: bold;
      }
      
      .stat-item span {
        font-size: 24px;
        margin-left: 5px;
      }
      
      .upgrades-section, .perks-section {
        margin-top: 15px;
        padding: 0 10px 10px 10px;
      }
      
      .section-label {
        font-weight: bold;
        font-size: 16px;
        margin-bottom: 5px;
      }
      
      .perks-table {
        width: 100%;
        border-collapse: collapse;
      }
      
      .perks-table th, .perks-table td {
        border: 1px solid black;
        padding: 5px;
        text-align: left;
      }
      
      .ammo-box {
        width: 20px;
        height: 20px;
        border: 1px solid black;
        display: inline-block;
        margin-right: 2px;
      }
      
      /* QR Code Footer */
      .print-footer-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #ccc;
        page-break-inside: avoid;
      }
      
      .qr-section {
        text-align: center;
      }
      
      .qr-code {
        max-width: 120px;
        height: auto;
        margin: 0 auto;
        display: block;
        border: 1px solid #000;
        background: #fff;
      }
      
      .qr-caption {
        margin-top: 6px;
        font-size: 0.9em;
        color: #666;
      }
      
      /* Footer */
      .dashboard-footer {
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #666;
        flex-grow: 1;
      }
    </style>
    <script>
    // Add listener to run after page loads
    window.addEventListener('DOMContentLoaded', function() {
      console.log('Dashboard window loaded - adding controls');
      
      // Add buttons manually via script
      var buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'print-buttons';
      buttonsDiv.style.position = 'fixed';
      buttonsDiv.style.top = '10px';
      buttonsDiv.style.right = '10px';
      buttonsDiv.style.zIndex = '1000';
      buttonsDiv.style.display = 'flex';
      buttonsDiv.style.gap = '10px';
      
      // Print button
      var printBtn = document.createElement('button');
      printBtn.innerHTML = 'Print';
      printBtn.className = 'print-button print-button-print';
      printBtn.style.padding = '8px 16px';
      printBtn.style.border = 'none';
      printBtn.style.borderRadius = '4px';
      printBtn.style.fontWeight = 'bold';
      printBtn.style.cursor = 'pointer';
      printBtn.style.fontSize = '14px';
      printBtn.style.backgroundColor = '#2563eb';
      printBtn.style.color = 'white';
      printBtn.onclick = function() { window.print(); };
      
      // Close button
      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = 'Close Window';
      closeBtn.className = 'print-button print-button-close';
      closeBtn.style.padding = '8px 16px';
      closeBtn.style.border = 'none';
      closeBtn.style.borderRadius = '4px';
      closeBtn.style.fontWeight = 'bold';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.fontSize = '14px';
      closeBtn.style.backgroundColor = '#d97706';
      closeBtn.style.color = 'white';
      closeBtn.onclick = function() { window.close(); };
      
      // Add settings button
      var settingsBtn = document.createElement('button');
      settingsBtn.innerHTML = 'Change Print Settings';
      settingsBtn.className = 'print-button print-button-settings';
      settingsBtn.style.padding = '8px 16px';
      settingsBtn.style.border = 'none';
      settingsBtn.style.borderRadius = '4px';
      settingsBtn.style.fontWeight = 'bold';
      settingsBtn.style.cursor = 'pointer';
      settingsBtn.style.fontSize = '14px';
      settingsBtn.style.backgroundColor = '#047857'; // Green
      settingsBtn.style.color = 'white';
      settingsBtn.onclick = function() {
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
        window.close();
      };
      
      // Add buttons to div
      buttonsDiv.appendChild(printBtn);
      buttonsDiv.appendChild(settingsBtn);
      buttonsDiv.appendChild(closeBtn);
      
      // Add div to document
      document.body.appendChild(buttonsDiv);
    });
    </script>
  </head>
  <body>
    <!-- Sponsor Header -->
    <div class="sponsor-header">
      <div>
        <div class="sponsor-name">${sponsorName}</div>
        <div class="sponsor-description">${sponsorDescription}</div>
      </div>
      <div style="text-align: right;">
        <div class="sponsor-name">${totalCans} / ${maxCans} cans</div>
        <div class="sponsor-description">Total team cost</div>
      </div>
    </div>

    <!-- Vehicle Dashboards -->
    ${vehicleDashboardsHtml}
    
    <!-- Equipment and Perk Descriptions (if enabled) -->
    ${showEquipmentDescriptions || showPerkDescriptions ? `
    <div class="descriptions-section" style="margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px;">
      ${showEquipmentDescriptions ? `
      <div class="equipment-descriptions" style="margin-bottom: 20px;">
        <h2 style="font-size: 24px; margin-bottom: 10px; color: #333;">Equipment Descriptions</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #888; width: 25%;">Equipment</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #888;">Description</th>
            </tr>
          </thead>
          <tbody>
            ${generateEquipmentDescriptionsHtml(vehicles)}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${showPerkDescriptions ? `
      <div class="perk-descriptions">
        <h2 style="font-size: 24px; margin-bottom: 10px; color: #333;">Perk Descriptions</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #888; width: 25%;">Perk</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #888;">Description</th>
            </tr>
          </thead>
          <tbody>
            ${generatePerkDescriptionsHtml(vehicles, sponsorPerks)}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${showSpecialRules ? `
      <div class="special-rules-descriptions">
        <h2 style="font-size: 24px; margin-bottom: 10px; color: #333;">Vehicle Special Rules</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #888; width: 25%;">Rule</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #888;">Description</th>
            </tr>
          </thead>
          <tbody>
            ${generateVehicleSpecialRulesHtml(vehicles)}
          </tbody>
        </table>
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Footer with QR Code -->
    <div class="print-footer-container">
      <div class="dashboard-footer">
        Generated by <a href="https://www.GaslandsGarage.com" target="_blank">GaslandsGarage.com</a> on ${new Date().toLocaleDateString()}
      </div>

      <div class="qr-section">
        ${qrCode ?
          `<img src="${qrCode}" class="qr-code" alt="QR Code for team" style="width:120px; height:120px;">` :
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
 * Generate HTML for a dashboard-style vehicle card
 */
function generateVehicleDashboardHtml(vehicle: any, sponsorName: string): string {
  if (!vehicle) {
    return '<div class="dashboard-card">Error: Invalid vehicle data</div>';
  }
  
  try {
    // Extract needed data with defensive coding
    const name = vehicle.name || 'Vehicle';
    const vehicleType = vehicle.vehicleType || {};
    const typeName = vehicleType.name || 'Car';
    const stats = vehicle.stats || {};
    const cost = vehicle.cost || 0;
    
    // Get lists of weapons, upgrades, and perks
    const weaponObjects = Array.isArray(vehicle.weaponObjects) ? vehicle.weaponObjects : [];
    const upgradeObjects = Array.isArray(vehicle.upgradeObjects) ? vehicle.upgradeObjects : [];
    const perkObjects = Array.isArray(vehicle.perkObjects) ? vehicle.perkObjects : [];
    
    // Get hull, handling, crew, and max gear
    const hull = stats.hull || 4;
    const handling = stats.handling || vehicleType.handling || 4;
    const crew = stats.crew || vehicleType.crew || 1;
    const maxGear = stats.gear || vehicleType.maxGear || 6;
    const weight = getWeightText(stats.weight || vehicleType.weight || 2);
    
    // Generate hull boxes (more similar to reference image)
    let hullBoxesHtml = '';
    for (let i = 0; i < hull; i++) {
      hullBoxesHtml += '<div class="hull-box"></div>';
    }
    
    // Generate weapons table rows
    let weaponsTableHtml = '';
    if (weaponObjects.length > 0) {
      weaponObjects.forEach(weapon => {
        // Get weapon details
        const weaponName = weapon.name || 'Unknown Weapon';
        const facing = weapon.facing || 'Front';
        
        // Get range directly from the weapon data
        let range = weapon.range || 'Short';
        
        // Clean up empty values
        if (typeof range === 'string' && range.trim().length === 0) {
          range = 'Short';
        }
        
        // Format attack dice
        let attackDice = weapon.attackDice || '0D6';
        // Ensure number has "D6" suffix
        if (typeof attackDice === 'number' || /^\d+$/.test(attackDice)) {
          attackDice = `${attackDice}D6`;
        }
        
        // Generate ammo boxes based on weapon special rules
        let ammoBoxes = 0;
        
        // First check if weapon has AMMO special rule
        if (weapon.specialRules && weapon.specialRules.includes('AMMO')) {
          // Extract the ammo count from the AMMO X rule
          const ammoMatch = weapon.specialRules.match(/AMMO\s+(\d+)/i);
          if (ammoMatch && ammoMatch[1]) {
            ammoBoxes = parseInt(ammoMatch[1], 10);
          } else {
            // Default to 3 if AMMO is present but count can't be determined
            ammoBoxes = 3;
          }
        } 
        // Fallback to determining ammo count based on weapon type for compatibility
        else if (
          !weaponName.includes('Machine Gun') && // Explicitly exclude Machine Guns from having ammo boxes
          (
            weaponName.includes('Napalm') ||
            weaponName.includes('Flamethrower') ||
            weaponName.includes('Rockets') || 
            weaponName.includes('Missile') || 
            weaponName.includes('Oil') || 
            weaponName.includes('Slick') ||
            weaponName.includes('Dropper') ||
            weaponName.includes('Mine') || 
            weaponName.includes('Bomb') || 
            weaponName.includes('Smoke') ||
            weaponName.includes('Glue') ||
            weaponName.includes('Caltrop')
          )
        ) {
          ammoBoxes = 3;
        }
        
        let ammoBoxesHtml = '';
        if (ammoBoxes > 0) {
          for (let i = 0; i < ammoBoxes; i++) {
            ammoBoxesHtml += '<div class="ammo-box"></div>';
          }
        } else {
          ammoBoxesHtml = '&mdash;';
        }
        
        // Get special rules
        const specialRules = weapon.specialRules || '';
        
        // Add row to table (matching reference image layout)
        weaponsTableHtml += `
        <tr>
          <td>${weaponName}</td>
          <td>${facing}</td>
          <td>${range}</td>
          <td>${attackDice}</td>
          <td>${ammoBoxesHtml}</td>
          <td>${specialRules}</td>
        </tr>`;
      });
    }
    
    // If no weapons, add a "No weapons" row
    if (weaponsTableHtml === '') {
      weaponsTableHtml = `
      <tr>
        <td colspan="6" style="text-align: center;">No weapons installed</td>
      </tr>`;
    }
    
    // Generate upgrades list
    let upgradesHtml = '';
    if (upgradeObjects.length > 0) {
      upgradeObjects.forEach(upgrade => {
        const upgradeName = upgrade.name || 'Unknown Upgrade';
        const upgradeRules = upgrade.specialRules || '';
        
        // Include the rules if available
        upgradesHtml += `<div style="margin-bottom: 5px;"><strong>${upgradeName}</strong>${upgradeRules ? `: ${upgradeRules}` : ''}</div>`;
      });
    } else {
      upgradesHtml = '<div style="text-align: center;">No upgrades installed</div>';
    }
    
    // Generate perks table with complete rules
    let perksTableHtml = '';
    if (perkObjects.length > 0) {
      perkObjects.forEach(perk => {
        const perkName = perk.name || 'Unknown Perk';
        // Use text or rules, whichever is available
        const perkText = perk.text || perk.rules || 'No description available.';
        
        perksTableHtml += `
        <tr>
          <td style="font-weight: bold; width: 25%;">${perkName}</td>
          <td>${perkText}</td>
        </tr>`;
      });
    } else {
      perksTableHtml = `
      <tr>
        <td colspan="2" style="text-align: center;">No perks</td>
      </tr>`;
    }
    
    // Combine vehicle type and perks/abilities for the subheader
    const vehicleTypePerks = [
      weight, 
      typeName
    ];
    
    // Add any team-wide perks like "Thumpermonkey" or "Dynamo"
    if (perkObjects.length > 0) {
      const teamwidePerkNames = perkObjects.map(p => p.name || '').filter(Boolean);
      if (teamwidePerkNames.length > 0) {
        vehicleTypePerks.push(...teamwidePerkNames);
      }
    }
    
    // Return complete dashboard HTML
    return `
    <div class="dashboard-card">
      <div class="vehicle-header">
        <div>
          <div>${name}</div>
          <div class="vehicle-type-perks">${vehicleTypePerks.join(', ')}</div>
        </div>
        <div>
          ${sponsorName}<br>
          <strong>${cost} cans</strong>
        </div>
      </div>
      
      <div style="padding: 0 10px;">
        <div class="hull-track">
          <div class="hull-label">Hull</div>
          <div class="hull-boxes">${hullBoxesHtml}</div>
        </div>
        
        <div class="dashboard-stats">
          <div class="stat-row" style="flex: 1; margin-right: 20px;">
            <div class="stat-item">Handling <span>${handling}</span></div>
            <div class="stat-item" style="margin-right: 20px;">Crew <span>${crew}</span></div>
          </div>
          
          <div style="display: flex; gap: 15px;">
            <div class="stat-box">
              <div class="stat-box-label">Max Gear</div>
              <div class="stat-box-value">${maxGear}</div>
            </div>
            
            <div class="stat-box">
              <div class="stat-box-label">Hazards</div>
              <div class="stat-box-value"></div>
            </div>
          </div>
        </div>
      </div>
      
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>Weapon</th>
            <th>Facing</th>
            <th>Range</th>
            <th>Attack</th>
            <th>Ammo</th>
            <th>Rules</th>
          </tr>
        </thead>
        <tbody>
          ${weaponsTableHtml}
        </tbody>
      </table>
      
      <div class="upgrades-section">
        <div class="section-label">Upgrades:</div>
        ${upgradesHtml}
      </div>
      
      <table class="perks-table">
        <thead>
          <tr>
            <th>Perk</th>
            <th>Rules</th>
          </tr>
        </thead>
        <tbody>
          ${perksTableHtml}
        </tbody>
      </table>
    </div>
    `;
  } catch (error) {
    console.error("[PrintService-new] Error generating dashboard HTML:", error);
    return `<div class="dashboard-card">Error generating dashboard: ${error.message}</div>`;
  }
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
 * Generate HTML for equipment descriptions table
 */
function generateEquipmentDescriptionsHtml(vehicles: any[]): string {
  if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
    return '<tr><td colspan="2">No equipment found</td></tr>';
  }
  
  // Collect all unique weapons and upgrades
  const weaponMap = new Map();
  const upgradeMap = new Map();
  
  vehicles.forEach(vehicle => {
    // Process weapons
    if (vehicle.weaponObjects && Array.isArray(vehicle.weaponObjects)) {
      vehicle.weaponObjects.forEach((weapon: any) => {
        if (weapon && weapon.name && !weaponMap.has(weapon.name)) {
          weaponMap.set(weapon.name, {
            name: weapon.name,
            specialRules: weapon.specialRules || '',
            cost: weapon.cost || 0
          });
        }
      });
    }
    
    // Process upgrades
    if (vehicle.upgradeObjects && Array.isArray(vehicle.upgradeObjects)) {
      vehicle.upgradeObjects.forEach((upgrade: any) => {
        if (upgrade && upgrade.name && !upgradeMap.has(upgrade.name)) {
          upgradeMap.set(upgrade.name, {
            name: upgrade.name,
            specialRules: upgrade.specialRules || '',
            cost: upgrade.cost || 0
          });
        }
      });
    }
  });
  
  // Create HTML rows
  let rowsHtml = '';
  
  // Add weapons
  weaponMap.forEach(weapon => {
    rowsHtml += `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px; text-align: left; vertical-align: top; font-weight: bold;">${weapon.name} (${weapon.cost} cans)</td>
      <td style="padding: 8px; text-align: left;">${weapon.specialRules || 'No description available'}</td>
    </tr>`;
  });
  
  // Add upgrades
  upgradeMap.forEach(upgrade => {
    rowsHtml += `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px; text-align: left; vertical-align: top; font-weight: bold;">${upgrade.name} (${upgrade.cost} cans)</td>
      <td style="padding: 8px; text-align: left;">${upgrade.specialRules || 'No description available'}</td>
    </tr>`;
  });
  
  return rowsHtml || '<tr><td colspan="2">No equipment descriptions available</td></tr>';
}

/**
 * Generate HTML for perk descriptions table
 */
function generatePerkDescriptionsHtml(vehicles: any[], sponsorPerks: any): string {
  if ((!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) && (!sponsorPerks)) {
    return '<tr><td colspan="2">No perks found</td></tr>';
  }
  
  // Collect all unique perks
  const perkMap = new Map();
  
  // Process vehicle perks - these are explicitly purchased
  vehicles.forEach(vehicle => {
    if (vehicle.perkObjects && Array.isArray(vehicle.perkObjects)) {
      vehicle.perkObjects.forEach((perk: any) => {
        if (perk && perk.name && !perkMap.has(perk.name)) {
          perkMap.set(perk.name, {
            name: perk.name,
            text: perk.text || '',
            level: perk.level || 1,
            type: 'vehicle' // These are vehicle-specific perks
          });
        }
      });
    }
  });
  
  // Process sponsor perks if available
  if (sponsorPerks) {
    // Build a set of all purchased perk IDs and names
    const purchasedPerkClasses = new Set();
    vehicles.forEach(vehicle => {
      // First try perkObjects (enhanced format)
      if (vehicle.perkObjects && Array.isArray(vehicle.perkObjects)) {
        vehicle.perkObjects.forEach((perk: any) => {
          // Try id, or if not available, try name
          if (perk) {
            if (perk.id) {
              purchasedPerkClasses.add(perk.id);
            } else if (perk.name) {
              purchasedPerkClasses.add(perk.name);
            }
          }
        });
      }
      // Fallback to perks array if perkObjects not available
      else if (vehicle.perks && Array.isArray(vehicle.perks)) {
        vehicle.perks.forEach((perk: any) => {
          if (typeof perk === 'string') {
            purchasedPerkClasses.add(perk);
          } else if (perk && perk.id) {
            purchasedPerkClasses.add(perk.id);
          } else if (perk && perk.name) {
            purchasedPerkClasses.add(perk.name);
          }
        });
      }
    });
    
    // Only include class perks that have been purchased
    if (sponsorPerks.classPerksList && Array.isArray(sponsorPerks.classPerksList)) {
      sponsorPerks.classPerksList.forEach((perk: any) => {
        // Only include if it's been purchased
        if (perk && perk.name && !perkMap.has(perk.name) && 
            (purchasedPerkClasses.has(perk.id) || purchasedPerkClasses.has(perk.name))) {
          perkMap.set(perk.name, {
            name: perk.name,
            text: perk.text || '',
            level: perk.level || 1,
            type: 'purchased' // Mark as purchased perk
          });
        }
      });
    }
    
    // Always include sponsor-specific perks
    if (sponsorPerks.sponsorPerksList && Array.isArray(sponsorPerks.sponsorPerksList)) {
      sponsorPerks.sponsorPerksList.forEach((perk: any) => {
        if (perk && perk.name && !perkMap.has(perk.name)) {
          perkMap.set(perk.name, {
            name: perk.name,
            text: perk.text || '',
            level: perk.level || 1,
            type: 'sponsor' // Mark as sponsor perk
          });
        }
      });
    }
  }
  
  // Create HTML rows - separate into sponsor perks and purchased perks
  let sponsorPerksHtml = '';
  let purchasedPerksHtml = '';
  let otherPerksHtml = '';  // For any perks that don't have a type
  
  perkMap.forEach(perk => {
    const levelText = perk.level > 1 ? ` (Level ${perk.level})` : '';
    const perkRow = `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px; text-align: left; vertical-align: top; font-weight: bold;">${perk.name}${levelText}</td>
      <td style="padding: 8px; text-align: left;">${perk.text || 'No description available'}</td>
    </tr>`;
    
    if (perk.type === 'sponsor') {
      sponsorPerksHtml += perkRow;
    } else if (perk.type === 'purchased') {
      purchasedPerksHtml += perkRow;
    } else {
      // Vehicle-specific perks or untyped perks
      otherPerksHtml += perkRow;
    }
  });
  
  // Combine sections with headers
  let rowsHtml = '';
  
  // Add sponsor perks section if any exist
  if (sponsorPerksHtml) {
    rowsHtml += `
    <tr>
      <td colspan="2" style="padding: 12px 8px; text-align: left; font-weight: bold; background-color: #f3f3f3; border-bottom: 2px solid #ddd; font-size: 1.1em;">
        Sponsor Perks
      </td>
    </tr>
    ${sponsorPerksHtml}`;
  }
  
  // Add purchased perks section if any exist
  if (purchasedPerksHtml) {
    rowsHtml += `
    ${rowsHtml ? '<tr><td colspan="2" style="height: 20px;"></td></tr>' : ''}
    <tr>
      <td colspan="2" style="padding: 12px 8px; text-align: left; font-weight: bold; background-color: #f3f3f3; border-bottom: 2px solid #ddd; font-size: 1.1em;">
        Purchased Perks
      </td>
    </tr>
    ${purchasedPerksHtml}`;
  }
  
  // Add other perks section if any exist
  if (otherPerksHtml) {
    rowsHtml += `
    ${rowsHtml ? '<tr><td colspan="2" style="height: 20px;"></td></tr>' : ''}
    <tr>
      <td colspan="2" style="padding: 12px 8px; text-align: left; font-weight: bold; background-color: #f3f3f3; border-bottom: 2px solid #ddd; font-size: 1.1em;">
        Purchased Perks
      </td>
    </tr>
    ${otherPerksHtml}`;
  }
  
  return rowsHtml || '<tr><td colspan="2">No perk descriptions available</td></tr>';
}

/**
 * Generate HTML table rows for vehicle special rules descriptions
 */
function generateVehicleSpecialRulesHtml(vehicles: any[]): string {
  if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
    return '<tr><td colspan="2">No special rules found</td></tr>';
  }
  
  // Collect all unique special rules
  const specialRulesMap = new Map();
  
  vehicles.forEach(vehicle => {
    // Get the vehicle type object (which contains the specialRules string)
    const vehicleType = vehicle.vehicleType || {};
    
    if (vehicleType && vehicleType.specialRules) {
      // Split the comma-separated rules
      const rulesArray = vehicleType.specialRules.split(',').map(rule => rule.trim());
      
      rulesArray.forEach(ruleName => {
        if (!specialRulesMap.has(ruleName)) {
          // Find rule description if it exists
          let ruleDescription = 'Description not available';
          
          if (vehicle.vehicleRules && Array.isArray(vehicle.vehicleRules)) {
            // First, try with exact case matching
            let ruleDetails = vehicle.vehicleRules.find(r => r.ruleName === ruleName);
            
            // If not found, try case-insensitive matching
            if (!ruleDetails) {
              ruleDetails = vehicle.vehicleRules.find(r => 
                r.ruleName.toLowerCase() === ruleName.toLowerCase()
              );
            }
            
            // If found and has rule text, use it
            if (ruleDetails && ruleDetails.rule) {
              ruleDescription = ruleDetails.rule;
            }
            
            // Debug info
            console.log(`[PrintService] Looking for rule ${ruleName}, found: ${Boolean(ruleDetails)}`);
          }
          
          specialRulesMap.set(ruleName, {
            name: ruleName,
            description: ruleDescription
          });
        }
      });
    }
  });
  
  if (specialRulesMap.size === 0) {
    return '<tr><td colspan="2">No special rules found</td></tr>';
  }
  
  // Convert map to array and sort by rule name
  const specialRulesArray = Array.from(specialRulesMap.values())
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // Generate HTML for each rule
  let rulesHtml = '';
  specialRulesArray.forEach(rule => {
    rulesHtml += `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px; text-align: left; vertical-align: top; font-weight: bold;">${rule.name}</td>
      <td style="padding: 8px; text-align: left;">${rule.description && rule.description.includes('<p>') ? rule.description : `<p>${rule.description}</p>`}</td>
    </tr>`;
  });
  
  return rulesHtml || '<tr><td colspan="2">No special rules available</td></tr>';
}

/**
 * Main print function that generates and opens printable content in a new window
 */
/**
 * Print team in Dashboard style - separate function for clarity
 */
export async function printTeamDashboard(draft: Draft): Promise<void> {
  console.log("[PrintService-new] printTeamDashboard called");
  console.log("[PrintService-new] Draft structure:", Object.keys(draft));
  
  try {
    // Log details of draft for debugging
    console.log("[PrintService-new] Draft details:", {
      teamName: draft.teamName,
      sponsorName: draft.sponsorName,
      hasVehicles: Boolean(draft.vehicles),
      isVehiclesArray: Array.isArray(draft.vehicles),
      vehiclesLength: draft.vehicles?.length,
      firstVehicle: draft.vehicles?.[0] ? Object.keys(draft.vehicles[0]) : null,
      printStyle: draft.printStyle,
      showEquipmentDescriptions: draft.showEquipmentDescriptions,
      showPerkDescriptions: draft.showPerkDescriptions,
      showSpecialRules: draft.showSpecialRules
    });
    
    // Basic validation
    if (!draft || !draft.vehicles || !Array.isArray(draft.vehicles) || draft.vehicles.length === 0) {
      alert("Cannot print: No vehicles found in team");
      return;
    }
    
    // Collect data for printing
    const printData = {
      teamName: draft.teamName || 'Gaslands Team',
      totalCans: draft.totalCans || 0,
      maxCans: draft.maxCans || 50,
      sponsorName: draft.sponsorName || 'No Sponsor',
      sponsor: draft.sponsor || null,
      sponsorPerks: draft.showPerkDescriptions ? (draft.sponsorPerks || null) : null,
      vehicles: draft.vehicles,
      qrCode: draft.qrCode,
      showEquipmentDescriptions: draft.showEquipmentDescriptions ?? true,
      showPerkDescriptions: draft.showPerkDescriptions ?? true,
      printStyle: 'dashboard' // Force dashboard style
    };
    
    // Generate dashboard HTML
    console.log("[PrintService-new] Generating dashboard HTML with data:", {
      teamName: printData.teamName,
      sponsorName: printData.sponsorName,
      vehicleCount: printData.vehicles.length,
      showEquipmentDescriptions: printData.showEquipmentDescriptions,
      showPerkDescriptions: printData.showPerkDescriptions,
      showSpecialRules: printData.showSpecialRules,
      vehicleRulesAvailable: printData.vehicles[0]?.vehicleRules ? true : false,
      firstVehicleId: printData.vehicles[0]?.id || 'none'
    });
    
    // Call the generateDashboardHtml function to create the full dashboard HTML
    const dashboardHtml = generateDashboardHtml(printData);
    
    // Open and populate print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to print your team');
      return;
    }
    
    // Write simplified HTML
    printWindow.document.write(dashboardHtml);
    printWindow.document.close();
    
    // Print after a delay
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (printError) {
        console.error("[PrintService-new] Error during simplified dashboard printing:", printError);
        alert('Error during printing. Please try again.');
      }
    }, 1000);
  } catch (error) {
    console.error("[PrintService-new] Error in printTeamDashboard:", error);
    console.error("[PrintService-new] Dashboard error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      typeof_draft: typeof draft,
      draft_keys: draft ? Object.keys(draft) : null,
      vehicles_length: draft?.vehicles?.length
    });
    alert('There was an error preparing for dashboard printing. Please try again.');
  }
}

/**
 * Main print function that generates and opens printable content in a new window
 */
export async function printTeam(printStyle: string, draft: Draft): Promise<void> {
  // Check if we should use the dashboard style - handle various naming variations
  const actualPrintStyle = String(printStyle || draft.printStyle || 'classic').toLowerCase().trim();
  
  if (actualPrintStyle === 'dashboard' || actualPrintStyle === 'dashboard_v2' || actualPrintStyle.includes('dashboard')) {
    console.log("[PrintService-new] Redirecting to dashboard print style from:", { printStyle, draftPrintStyle: draft.printStyle });
    // Make sure printStyle is set in the draft
    draft.printStyle = 'dashboard';
    return printTeamDashboard(draft);
  }
  
  // Continue with classic style
  console.log("[PrintService-new] printTeam called with style parameter:", printStyle);
  console.log("[PrintService-new] Draft printStyle:", draft.printStyle);
  console.log("[PrintService-new] Using classic style");

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

    // Check if vehicles array exists and contains at least one valid vehicle
    const hasValidVehicles = draft.vehicles && 
      Array.isArray(draft.vehicles) && 
      draft.vehicles.length > 0 &&
      draft.vehicles.some(v => v && typeof v === 'object');
      
    if (!hasValidVehicles) {
      console.error("[PrintService-new] No valid vehicles found in draft data", draft.vehicles);
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
      // Always include sponsorPerks data, but control visibility in the templates
      sponsorPerks: draft.sponsorPerks || null,
      vehicles: draft.vehicles,
      qrCode: qrCode,
      showEquipmentDescriptions: showEquipmentDescriptions,
      showPerkDescriptions: showPerkDescriptions,
      showSpecialRules: draft.showSpecialRules ?? true
    };
    
    // Make sure printStyle is passed correctly to the data
    printData.printStyle = printStyle;
    console.log("[PrintService-new] Using print style for HTML generation:", printStyle);
    console.log("[PrintService-new] Print data settings:", {
      showEquipmentDescriptions: printData.showEquipmentDescriptions,
      showPerkDescriptions: printData.showPerkDescriptions,
      showSpecialRules: printData.showSpecialRules,
      vehicleRulesAvailable: printData.vehicles[0]?.vehicleRules ? true : false,
      firstVehicleId: printData.vehicles[0]?.id || 'none'
    });
    
    // Generate printable HTML
    const printHtml = generatePrintableHtml(printData);
    
    // Log the HTML for debugging
    console.log("[PrintService-new] Generated HTML length:", printHtml.length);
    console.log("[PrintService-new] Generated HTML contains dashboard:", printHtml.includes("dashboard-card"));
    
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
    console.error("[PrintService-new] Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    alert('There was an error preparing for printing. Please try again.');
  }
}

/**
 * Add print and close buttons to the print window
 */
function addPrintButtons(printWindow: Window): void {
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
  
  // Update button positions to avoid overlapping
  printButton.style.right = '150px'; // Left button
  closeButton.style.right = '10px'; // Right button
  
  // Add elements to the document
  printWindow.document.body.insertBefore(closeButton, printWindow.document.body.firstChild);
  printWindow.document.body.insertBefore(printButton, printWindow.document.body.firstChild);
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