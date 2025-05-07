<script lang="ts">
	import { nanoid } from 'nanoid';
	import { validateDraft } from '$lib/validate';
	import type { Draft, Validation } from '$lib/validate/model';
	import { encodeDraft, decodeDraft } from '$lib/draft/io';
	import { goto } from '$app/navigation';
	import { draftToDataURL } from '$lib/draft/qr';

	/* ---------- server data ---------- */
	export let data: {
		sponsors: import('$lib/rules/types').Sponsor[];
		vehicleTypes: import('$lib/rules/types').Vehicle[];
		weapons: import('$lib/rules/types').Weapon[];
		upgrades: import('$lib/rules/types').Upgrade[];
		perks: import('$lib/rules/types').Perk[];
	};
	const { sponsors, vehicleTypes, weapons, upgrades, perks } = data;

	/* ---------- UI state ---------- */
	let sponsorId: string = sponsors[0]?.id ?? '';
	type Veh = { id: string; type: string; name: string; weapons: string[]; upgrades: string[]; perks: string[] };
	let vehicles: Veh[] = [];

	function addVehicle(type = filteredVehicleTypes[0]?.id) {
		const vt = vehicleTypes.find((v) => v.id === type)!;
		vehicles = [
			...vehicles,
			{
				id: nanoid(6),
				type: vt.id,
				name: `New ${vt.name}`,
				weapons: [],
				upgrades: [],
				perks: []
			}
		];
	}

	function removeVehicle(id: string) {
		vehicles = vehicles.filter((v) => v.id !== id);
	}

	function addWeapon(vehicleId: string, weaponId: string) {
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, weapons: [...v.weapons, weaponId] } :
			v
		);
	}

	function removeWeapon(vehicleId: string, weaponIndex: number) {
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, weapons: v.weapons.filter((_, idx) => idx !== weaponIndex) } :
			v
		);
	}

	function addUpgrade(vehicleId: string, upgradeId: string) {
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, upgrades: [...v.upgrades, upgradeId] } :
			v
		);
	}

	function removeUpgrade(vehicleId: string, upgradeIndex: number) {
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, upgrades: v.upgrades.filter((_, idx) => idx !== upgradeIndex) } :
			v
		);
	}

	function addPerk(vehicleId: string, perkId: string) {
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, perks: [...v.perks, perkId] } :
			v
		);
	}

	function removePerk(vehicleId: string, perkIndex: number) {
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, perks: v.perks.filter((_, idx) => idx !== perkIndex) } :
			v
		);
	}

	/* ---------- modals & menu state ---------- */
	let qrDataUrl: string | null = null;
	let showImportModal = false;
	let showSettingsModal = false;
	let showMenu = false;

	/* ---------- settings state ---------- */
	let enableSponsorships = true;
	let includeAdvanced = true;

	/* ---------- menu actions ---------- */
	async function copyDraft() {
		await navigator.clipboard.writeText(encodeDraft(currentDraft));
		alert('Draft copied to clipboard!');
	}

	function shareLink() {
		const encoded = encodeDraft(currentDraft);
		goto(`?draft=${encoded}`, { replaceState: true });
		alert('Link updated in address bar. Copy the current URL to share your build.');
	}

	async function generateQRCode() {
		// Generate QR code and show the modal
		qrDataUrl = await draftToDataURL(currentDraft);
	}

	async function printTeam() {
		// Generate QR code if it doesn't exist yet
		if (!qrDataUrl) {
			qrDataUrl = await draftToDataURL(currentDraft);
		}
		window.print();
	}

	function importBuild() {
		showImportModal = true;
	}

	function openSettings() {
		showSettingsModal = true;
	}

	function importDraftString() {
		const draft = decodeDraft(importString.trim());
		if (draft) {
			sponsorId = draft.sponsor;
			vehicles = draft.vehicles as Veh[];
			importString = '';
			showImportModal = false;
		} else {
			alert('Invalid draft string');
		}
	}

	/* ---------- load from URL param (once) ---------- */
	if (typeof window !== 'undefined') {
		const url = new URL(window.location.href);
		const encoded = url.searchParams.get('draft');
		if (encoded) {
			const imported = decodeDraft(encoded);
			if (imported) {
				sponsorId = imported.sponsor;
				vehicles = imported.vehicles as Veh[];
			}
		}
	}
	
	/* ---------- setting changes effects ---------- */
	// When enableSponsorships is disabled, clear sponsor selection
	$: if (!enableSponsorships) {
		sponsorId = '';
	}
	
	// Remove any advanced vehicle types when includeAdvanced is disabled
	$: if (!includeAdvanced) {
		vehicles = vehicles.filter(v => {
			const vehicleType = vehicleTypes.find(vt => vt.id === v.type);
			return vehicleType && !vehicleType.advanced;
		});
	}
	
	// Remove any advanced weapons when includeAdvanced is disabled
	$: if (!includeAdvanced) {
		vehicles = vehicles.map(v => ({
			...v,
			weapons: v.weapons.filter(weaponId => {
				const weapon = weapons.find(w => w.id === weaponId);
				return weapon && !weapon.advanced;
			})
		}));
	}
	
	// Remove any advanced upgrades when includeAdvanced is disabled
	$: if (!includeAdvanced) {
		vehicles = vehicles.map(v => ({
			...v,
			upgrades: v.upgrades.filter(upgradeId => {
				const upgrade = upgrades.find(u => u.id === upgradeId);
				return upgrade && !upgrade.advanced;
			})
		}));
	}
	
	// Remove perks when enableSponsorships is disabled
	$: if (!enableSponsorships) {
		vehicles = vehicles.map(v => ({
			...v,
			perks: []
		}));
	}

	/* ---------- draft & validation ---------- */
	$: currentDraft = { sponsor: sponsorId, vehicles } satisfies Draft;
	let validation: Validation = { cans: 0, errors: [], vehicleReports: [] };
	$: validateDraft(currentDraft).then((r) => (validation = r));
	$: totalCans = validation.cans;
	$: teamErrors = validation.errors;
	
	/* ---------- filtered assets based on settings ---------- */
	// Filter vehicle types based on includeAdvanced setting
	$: filteredVehicleTypes = includeAdvanced 
		? vehicleTypes 
		: vehicleTypes.filter(v => !v.advanced);
	
	// Filter weapons based on includeAdvanced setting
	$: filteredWeapons = includeAdvanced 
		? weapons 
		: weapons.filter(w => !w.advanced);
	
	// Filter upgrades based on includeAdvanced setting
	$: filteredUpgrades = includeAdvanced 
		? upgrades 
		: upgrades.filter(u => !u.advanced);
	
	// Get available perks for the current sponsor
	$: currentSponsor = sponsors.find(s => s.id === sponsorId);
	$: availablePerks = enableSponsorships
		? perks.filter(p => currentSponsor?.perks.includes(p.id))
		: [];

	/* ---------- import box ---------- */
	let importString = '';
</script>

<div class="menu-bar print:hidden">
	<div class="menu-container">
		<span class="logo">
			<span class="logo-highlight">Gaslands</span> Garage
		</span>
		
		<button type="button" class="menu-item" on:click={copyDraft}>Copy Draft</button>
		<button type="button" class="menu-item" on:click={shareLink}>Share Link</button>
		<button type="button" class="menu-item" on:click={generateQRCode}>Generate QR Code</button>
		<button type="button" class="menu-item" on:click={printTeam}>Print Team</button>
		<button type="button" class="menu-item" on:click={importBuild}>Import Build</button>
		<button type="button" class="menu-item" on:click={openSettings}>Settings</button>
	</div>
</div>

<style>
/* Menu styles */
.menu-bar {
	background-color: #000000;
	color: white;
	padding: 12px 0;
	margin-bottom: 16px;
}

.menu-container {
	max-width: 896px;
	margin: 0 auto;
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	padding: 0 16px;
}

.logo {
	font-weight: bold;
	font-size: 1.125rem;
	margin-right: auto;
}

.logo-highlight {
	color: #f59e0b;
}

.menu-item {
	color: white;
	background: transparent;
	border: none;
	padding: 0;
	margin: 0;
	cursor: pointer;
	font: inherit;
}

.menu-item:hover {
	color: #fcd34d;
}

/* Hide print view by default */
#gaslands-print-view {
  display: none;
}

/* Print styles */
@media print {
  /* Hide elements that shouldn't be printed */
  .menu-bar,
  button[aria-label="Remove vehicle"],
  button[aria-label="Remove weapon"],
  button[aria-label="Remove upgrade"],
  button[aria-label="Remove perk"],
  .relative select,
  #import-draft,
  .bg-red-50,
  .bg-green-50 {
    display: none !important;
  }
  
  /* Page formatting */
  @page { 
    size: 8.5in 11in portrait; 
    margin: 0.5cm;
  }
  
  section {
    background-color: white !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  
  /* Reset padding from header for print */
  #builder-ui {
    padding-top: 0 !important;
  }
  
  /* Hide non-print components */
  .bg-white, .bg-stone-100, .grid-cols-7, #builder-ui, .p-4, .p-5, .p-6 {
    display: none !important;
  }
  
  /* General text formatting applied to print view container */
  #gaslands-print-view { 
    color: #000; 
    font-family: Arial, sans-serif; 
    display: block !important;
  }
  
  /* Force background printing */
  * { 
    -webkit-print-color-adjust: exact !important; 
    color-adjust: exact !important; 
  }
  
  /* Print-specific styles */
  @media print {
    /* Print styles already covered in parent media query */
  }
  
  /* Vehicle card styling */
  .vehicle-card-print {
    width: 316px;
    height: 275px;
    vertical-align: top;
    padding: 20px 32px;
    border: 2px solid #000;
    page-break-inside: avoid;
    margin-bottom: 20px;
    display: inline-block;
    position: relative;
    box-sizing: border-box;
  }
  
  /* Text styling */
  .uppercase { text-transform: uppercase; }
  .bold { font-weight: bold; }
  
  /* Hull boxes */
  .hull-box {
    width: 16px;
    height: 16px;
    background-color: #fff;
    border: 2px solid #000;
    display: inline-block;
    margin: 2px;
  }
  
  /* Vehicle card sections */
  .card-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  
  .card-name {
    font-size: 1.5em;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .card-stats {
    display: flex;
    margin-top: 5px;
    margin-bottom: 10px;
  }
  
  .card-hull {
    margin-top: 10px;
  }
  
  .card-gear {
    text-align: center;
    margin-left: auto;
    border: 2px solid #000;
    padding: 5px 15px;
    font-weight: bold;
  }
  
  .card-weapons {
    margin-top: 15px;
    font-size: 0.8em;
    height: 70px;
  }
  
  .card-footer {
    position: absolute;
    bottom: 20px;
    left: 32px;
    right: 32px;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  /* Team summary styling */
  .sponsor-print-header {
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid black;
    padding-bottom: 10px;
  }
  
  .sponsor-print-header h1 {
    font-size: 24pt;
    margin-bottom: 5px;
  }
  
  .print-card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    page-break-inside: auto;
  }
  
  .print-section {
    page-break-inside: avoid;
    margin-bottom: 20px;
  }
  
  
  .rotate90 {
    display: inline-block;
    transform: rotate(-90deg);
    margin-right: 10px;
    font-weight: bold;
  }
  
  .vehicle-type {
    font-size: 0.9em;
    font-weight: bold;
  }
  
  /* Perk details section below cards */
  #perk-details-print {
    margin-top: 30px;
    border-top: 2px solid #999;
    padding-top: 15px;
  }
  
  #perk-details-print h2 {
    font-size: 14pt;
    margin-bottom: 10px;
  }
  
  .perk-list {
    column-count: 2;
    column-gap: 30px;
  }
  
  .perk-item {
    margin-bottom: 10px;
    break-inside: avoid;
  }
  
  /* QR Code and footer styling */
  .print-footer {
    width: 100%;
    margin-top: 30px;
    border-top: 1px solid #ddd;
    padding-top: 10px;
    page-break-inside: avoid;
    display: flex;
    align-items: flex-end;
  }
  
  .qr-code-container {
    width: 120px;
    text-align: center;
  }
  
  .qr-code-image {
    width: 100px;
    height: 100px;
    border: 1px solid black;
    background-color: white;
    margin: 0 auto 5px auto;
  }
  
  .qr-code-placeholder {
    width: 100px;
    height: 100px;
    border: 1px solid black;
    background-color: white;
    margin: 0 auto 5px auto;
    text-align: center;
    line-height: 100px;
  }
  
  .qr-code-caption {
    font-size: 8pt;
  }
  
  .print-footer-text {
    flex: 1;
    font-size: 10pt;
    color: #666;
    text-align: center;
  }
}
</style>

<section id="builder-ui" class="max-w-4xl mx-auto p-6 bg-stone-100 min-h-screen">
	<header class="mb-8 text-center">
		<h1 class="text-4xl font-extrabold text-stone-800 tracking-tight">
			<span class="text-amber-600">Gaslands</span> Garage
		</h1>
		<p class="text-stone-600 mt-2">Build your team of deadly vehicles and dominate the wasteland</p>
	</header>

	<!-- Sponsor selector (only shown if enableSponsorships is true) -->
	{#if enableSponsorships}
		<div class="bg-white p-5 rounded-lg shadow-md mb-6">
			<label for="sponsor-select" class="block">
				<span class="text-lg font-bold text-stone-800 block mb-2">Choose Your Sponsor</span>
				<div class="relative">
					<select
						id="sponsor-select"
						bind:value={sponsorId}
						class="w-full px-4 py-3 border-2 border-amber-200 rounded-lg bg-white appearance-none pr-10 text-stone-800 focus:outline-none focus:border-amber-500"
					>
						{#each sponsors as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
					<!-- Dropdown arrow removed -->
				</div>
				<p class="mt-2 text-sm text-stone-600">
					{sponsors.find(s => s.id === sponsorId)?.source || "Unknown source"}
				</p>
			</label>
		</div>
	{:else}
		<!-- When sponsorships disabled, sponsorId will be cleared by reactivity -->
	{/if}

	<!-- Vehicle list -->
	<div class="mb-8">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-2xl font-bold text-stone-800">Your Vehicles</h2>
			<button
				class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors shadow-md flex items-center"
				on:click={() => addVehicle()}
			>
				<span class="mr-2">+</span>
				Add Vehicle
			</button>
		</div>

		{#if vehicles.length === 0}
			<div class="bg-white p-8 rounded-lg shadow-md text-center">
				<p class="text-stone-500 mt-4 text-lg">No vehicles yet. Add some vehicles to your team!</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				{#each vehicles as v (v.id)}
					<div class="bg-stone-200 rounded-lg shadow-md overflow-hidden border-2" style="border-color: {vehicleTypes.find(vt => vt.id === v.type)?.color || '#f59e0b'}">
						<!-- Vehicle header -->
						<div class="flex items-center justify-between bg-stone-300 p-3 border-b-2 border-gray-400">
							<div class="flex-1 min-w-0">
								<div class="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
									<div class="w-full sm:w-2/5">
										<label for="vehicle-type-{v.id}" class="block text-xs text-stone-600 mb-1 font-semibold uppercase">Vehicle Type</label>
										<select
											id="vehicle-type-{v.id}"
											bind:value={v.type}
											class="w-full p-2 border border-stone-300 rounded bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
											on:change={() => {
												const vt = vehicleTypes.find((t) => t.id === v.type)!;
												v.name = vt.name;
											}}
										>
											{#each filteredVehicleTypes as vt}
												<option value={vt.id}>{vt.name}</option>
											{/each}
										</select>
									</div>
									<div class="flex-1 w-full">
										<label for="vehicle-name-{v.id}" class="block text-xs text-stone-600 mb-1 font-semibold uppercase">Vehicle Name</label>
										<input
											id="vehicle-name-{v.id}"
											bind:value={v.name}
											class="w-full p-2 border border-stone-300 rounded bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
											placeholder="Vehicle name"
										/>
									</div>
								</div>
							</div>
							<button
								class="ml-4 p-2 h-8 w-8 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors self-start mt-6"
								on:click={() => removeVehicle(v.id)}
								aria-label="Remove vehicle"
							>
								<span>×</span>
								<span class="sr-only">Remove vehicle</span>
							</button>
						</div>
						
						<!-- Vehicle details -->
						<div class="p-4">
							<!-- Dashboard stats -->
							<div class="grid grid-cols-4 gap-2 text-sm bg-stone-100 p-3 rounded mt-0 mb-4">
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Cost</span>
									<span class="font-bold text-lg">
										{validation.vehicleReports.find(r => r.vehicleId === v.id)?.cans || '?'}
									</span>
									<span class="text-xs">cans</span>
								</div>
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Type</span>
									<span class="font-bold text-base truncate block">
										{vehicleTypes.find(vt => vt.id === v.type)?.name || 'Unknown'}
									</span>
								</div>
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Hull</span>
									<span class="font-bold text-lg">
										{vehicleTypes.find(vt => vt.id === v.type)?.maxHull || '?'}
									</span>
									<span class="text-xs">points</span>
								</div>
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Weapons</span>
									<span class="font-bold text-lg" class:text-red-600={v.weapons.length > (vehicleTypes.find(vt => vt.id === v.type)?.weaponSlots || 0)}>
										{v.weapons.length} / {vehicleTypes.find(vt => vt.id === v.type)?.weaponSlots || '?'}
									</span>
								</div>
							</div>
							
							<!-- Weapons section -->
							<div class="mb-4">
								<h3 class="font-bold text-stone-800 mb-2 flex items-center border-b border-stone-300 pb-1">
									<span class="bg-stone-300 px-2 py-1 rounded-t mr-2">WEAPONS</span>
								</h3>
								
								{#if v.weapons.length === 0}
									<p class="text-stone-500 text-sm italic px-2">No weapons equipped.</p>
								{:else}
									<ul class="space-y-1 mb-3 border border-stone-300 rounded overflow-hidden divide-y divide-stone-300">
										{#each v.weapons as weaponId, i}
											<li class="flex items-center justify-between bg-stone-50 px-3 py-2">
												<span class="text-stone-700 font-medium">{weapons.find(w => w.id === weaponId)?.name || weaponId}</span>
												<button
													class="p-1 h-6 w-6 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors"
													on:click={() => removeWeapon(v.id, i)}
													aria-label="Remove weapon"
												>
													<span>×</span>
													<span class="sr-only">Remove weapon</span>
												</button>
											</li>
										{/each}
									</ul>
								{/if}
								
								<div class="relative">
									<label for="add-weapon-{v.id}" class="sr-only">Add a weapon</label>
									<select
										id="add-weapon-{v.id}"
										class="w-full p-2 border border-stone-300 rounded bg-white text-stone-800 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
										on:change={e => {
											const target = e.target as HTMLSelectElement;
											const weaponId = target.value;
											if (weaponId) {
												addWeapon(v.id, weaponId);
												target.value = ""; // Reset selection
											}
										}}
										disabled={v.weapons.length >= (vehicleTypes.find(vt => vt.id === v.type)?.weaponSlots || 0)}
									>
										<option value="" disabled selected>+ Add weapon</option>
										{#each filteredWeapons as w}
											<option value={w.id}>{w.name}</option>
										{/each}
									</select>
									<!-- Dropdown arrow removed -->
								</div>
							</div>
							
							<!-- Upgrades section -->
							<div class="mb-4 mt-6">
								<h3 class="font-bold text-stone-800 mb-2 flex items-center border-b border-stone-300 pb-1">
									<span class="bg-stone-300 px-2 py-1 rounded-t mr-2">UPGRADES</span>
								</h3>
								
								{#if v.upgrades.length === 0}
									<p class="text-stone-500 text-sm italic px-2">No upgrades installed.</p>
								{:else}
									<ul class="space-y-1 mb-3 border border-stone-300 rounded overflow-hidden divide-y divide-stone-300">
										{#each v.upgrades as upgradeId, i}
											<li class="flex items-center justify-between bg-stone-50 px-3 py-2">
												<div class="flex-1">
													<span class="text-stone-700 font-medium block">{upgrades.find(u => u.id === upgradeId)?.name || upgradeId}</span>
													<span class="text-stone-500 text-xs">{upgrades.find(u => u.id === upgradeId)?.specialRules || ""}</span>
												</div>
												<button
													class="p-1 h-6 w-6 ml-2 flex-shrink-0 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors"
													on:click={() => removeUpgrade(v.id, i)}
													aria-label="Remove upgrade"
												>
													<span>×</span>
													<span class="sr-only">Remove upgrade</span>
												</button>
											</li>
										{/each}
									</ul>
								{/if}
								
								<div class="relative">
									<label for="add-upgrade-{v.id}" class="sr-only">Add an upgrade</label>
									<select
										id="add-upgrade-{v.id}"
										class="w-full p-2 border border-stone-300 rounded bg-white text-stone-800 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
										on:change={e => {
											const target = e.target as HTMLSelectElement;
											const upgradeId = target.value;
											if (upgradeId) {
												addUpgrade(v.id, upgradeId);
												target.value = ""; // Reset selection
											}
										}}
										disabled={v.upgrades.length >= (vehicleTypes.find(vt => vt.id === v.type)?.upgradeSlots || 0)}
									>
										<option value="" disabled selected>+ Add upgrade</option>
										{#each filteredUpgrades as u}
											<option value={u.id}>{u.name}</option>
										{/each}
									</select>
								</div>
							</div>
							
							<!-- Perks section -->
							<div class="mb-4 mt-6">
								<h3 class="font-bold text-stone-800 mb-2 flex items-center border-b border-stone-300 pb-1">
									<span class="bg-stone-300 px-2 py-1 rounded-t mr-2">PERKS</span>
									<span class="text-xs text-stone-500 ml-auto">(Available for {currentSponsor?.name || 'selected sponsor'})</span>
								</h3>
								
								{#if v.perks.length === 0}
									<p class="text-stone-500 text-sm italic px-2">No perks selected.</p>
								{:else}
									<ul class="space-y-1 mb-3 border border-stone-300 rounded overflow-hidden divide-y divide-stone-300">
										{#each v.perks as perkId, i}
											<li class="flex items-center justify-between bg-stone-50 px-3 py-2">
												<div class="flex-1">
													<span class="text-stone-700 font-medium block">{perks.find(p => p.id === perkId)?.name || perkId}</span>
													<span class="text-stone-500 text-xs">{perks.find(p => p.id === perkId)?.text || ""}</span>
												</div>
												<button
													class="p-1 h-6 w-6 ml-2 flex-shrink-0 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors"
													on:click={() => removePerk(v.id, i)}
													aria-label="Remove perk"
												>
													<span>×</span>
													<span class="sr-only">Remove perk</span>
												</button>
											</li>
										{/each}
									</ul>
								{/if}
								
								<div class="relative">
									<label for="add-perk-{v.id}" class="sr-only">Add a perk</label>
									<select
										id="add-perk-{v.id}"
										class="w-full p-2 border border-stone-300 rounded bg-white text-stone-800 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
										on:change={e => {
											const target = e.target as HTMLSelectElement;
											const perkId = target.value;
											if (perkId) {
												addPerk(v.id, perkId);
												target.value = ""; // Reset selection
											}
										}}
										disabled={availablePerks.filter(p => !v.perks.includes(p.id)).length === 0}
									>
										<option value="" disabled selected>+ Add perk</option>
										{#each availablePerks as p}
											{#if !v.perks.includes(p.id)}
												<option value={p.id}>{p.name} (Level {p.level})</option>
											{/if}
										{/each}
									</select>
								</div>
							</div>
							
							<!-- Vehicle stats -->
							<div class="grid grid-cols-7 gap-2 text-sm bg-stone-100 p-3 rounded mt-3">
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Cost</span>
									<span class="font-bold text-lg">
										{validation.vehicleReports.find(r => r.vehicleId === v.id)?.cans || '?'}
									</span>
									<span class="text-xs">cans</span>
								</div>
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Type</span>
									<span class="font-bold text-base truncate block">
										{vehicleTypes.find(vt => vt.id === v.type)?.name || 'Unknown'}
									</span>
								</div>
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Hull</span>
									<span class="font-bold text-lg">
										{vehicleTypes.find(vt => vt.id === v.type)?.maxHull || '?'}
									</span>
									<span class="text-xs">points</span>
								</div>
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Weapons</span>
									<span class="font-bold text-lg" class:text-red-600={v.weapons.length > (vehicleTypes.find(vt => vt.id === v.type)?.weaponSlots || 0)}>
										{v.weapons.length} / {vehicleTypes.find(vt => vt.id === v.type)?.weaponSlots || '?'}
									</span>
								</div>
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Max Gear</span>
									<span class="font-bold text-lg">
										{vehicleTypes.find(vt => vt.id === v.type)?.maxGear || '?'}
									</span>
								</div>
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Upgrades</span>
									<span class="font-bold text-lg" class:text-red-600={v.upgrades.length > (vehicleTypes.find(vt => vt.id === v.type)?.upgradeSlots || 0)}>
										{v.upgrades.length} / {vehicleTypes.find(vt => vt.id === v.type)?.upgradeSlots || '2'}
									</span>
								</div>
								<div class="bg-stone-300 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 uppercase font-semibold">Perks</span>
									<span class="font-bold text-lg" class:text-red-600={v.perks.some(perkId => !currentSponsor?.perks.includes(perkId))}>
										{v.perks.length} / {availablePerks.length}
									</span>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Totals / legality -->
	<div class="bg-white p-5 rounded-lg shadow-md mb-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-bold text-stone-800">Team Summary</h2>
			<div class="text-lg font-bold">
				<span class="text-stone-600">Total:</span>
				<span class="text-amber-600 ml-1">{totalCans} cans</span>
			</div>
		</div>

		{#if teamErrors.length === 0}
			<div class="flex items-center bg-green-50 text-green-800 p-4 rounded-lg">
				<span class="mr-2 text-green-500">✓</span>
				<span class="font-medium">Your team is legal and ready to race!</span>
			</div>
		{:else}
			<div class="bg-red-50 text-red-800 p-4 rounded-lg">
				<div class="flex items-center mb-2">
					<span class="mr-2 text-red-500">!</span>
					<span class="font-medium">Your team has issues that need fixing:</span>
				</div>
				<ul class="list-disc ml-12 space-y-1">
					{#each teamErrors as err}
						<li>{err}</li>
					{/each}
				</ul>
			</div>
		{/if}

    </div>

    <!-- QR Modal -->
    {#if qrDataUrl}
      <div
        class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        role="dialog"
        aria-modal="true"
        aria-label="QR Code"
        tabindex="-1"
      >
        <!-- Adding a button to make the whole backdrop clickable/accessible -->
        <button
          class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
          on:click={() => (qrDataUrl = null)}
          on:keydown={e => e.key === 'Escape' && (qrDataUrl = null)}
          aria-label="Close modal background"
        ></button>
        <div
          class="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4 relative z-10"
          role="document"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-stone-800">Team QR Code</h3>
            <button
              class="text-stone-400 hover:text-stone-600 transition-colors"
              on:click={() => (qrDataUrl = null)}
              aria-label="Close QR code modal"
            >
              <span>×</span>
              <span class="sr-only">Close</span>
            </button>
          </div>
          <div class="bg-white p-4 rounded-lg border border-stone-200">
            <img src={qrDataUrl} alt="team QR code" class="mx-auto w-64 h-64" />
          </div>
          <p class="mt-4 text-center text-stone-600 text-sm">
            Scan this QR code to share your team build
          </p>
          <div class="flex gap-4 mt-4">
            <button
              class="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
              on:click={() => (qrDataUrl = null)}
            >
              Close
            </button>
            <button
              class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              on:click={() => window.print()}
            >
              Print
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Import Modal -->
    {#if showImportModal}
      <div
        class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        role="dialog"
        aria-modal="true"
        aria-label="Import Build"
        tabindex="-1"
      >
        <!-- Adding a button to make the whole backdrop clickable/accessible -->
        <button
          class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
          on:click={() => (showImportModal = false)}
          on:keydown={e => e.key === 'Escape' && (showImportModal = false)}
          aria-label="Close modal background"
        ></button>
        <div
          class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 relative z-10"
          role="document"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-stone-800">Import Team Build</h3>
            <button
              class="text-stone-400 hover:text-stone-600 transition-colors"
              on:click={() => (showImportModal = false)}
              aria-label="Close import modal"
            >
              <span>×</span>
              <span class="sr-only">Close</span>
            </button>
          </div>
          
          <div class="space-y-4">
            <p class="text-stone-600">
              Paste a team build code below to import a shared build
            </p>
            <div class="space-y-3">
              <label for="import-draft" class="sr-only">Import team build code</label>
              <textarea
                id="import-draft"
                bind:value={importString}
                class="w-full px-4 py-2 border border-stone-300 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 min-h-[100px]"
                placeholder="Paste encoded draft here"
              ></textarea>
            </div>
            <div class="flex gap-3 justify-end">
              <button
                class="px-4 py-2 rounded-lg bg-stone-300 hover:bg-stone-400 text-stone-700 font-medium transition-colors"
                on:click={() => (showImportModal = false)}
              >
                Cancel
              </button>
              <button
                class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors"
                on:click={importDraftString}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Settings Modal -->
    {#if showSettingsModal}
      <div
        class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabindex="-1"
      >
        <!-- Adding a button to make the whole backdrop clickable/accessible -->
        <button
          class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
          on:click={() => (showSettingsModal = false)}
          on:keydown={e => e.key === 'Escape' && (showSettingsModal = false)}
          aria-label="Close modal background"
        ></button>
        <div
          class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 relative z-10"
          role="document"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-stone-800">Settings</h3>
            <button
              class="text-stone-400 hover:text-stone-600 transition-colors"
              on:click={() => (showSettingsModal = false)}
              aria-label="Close settings modal"
            >
              <span>×</span>
              <span class="sr-only">Close</span>
            </button>
          </div>
          
          <div class="space-y-6">
            <div class="space-y-2">
              <div class="flex items-center">
                <input 
                  type="checkbox" 
                  id="enable-sponsorships" 
                  bind:checked={enableSponsorships}
                  class="w-4 h-4 text-amber-600 bg-stone-100 border-stone-300 rounded focus:ring-amber-500"
                />
                <label for="enable-sponsorships" class="ml-2 text-stone-800 font-medium">
                  Enable Sponsorships
                </label>
              </div>
              <p class="text-stone-600 text-sm ml-6">
                If you prefer to build a team without using Sponsor or driver perks, uncheck this option.
              </p>
            </div>
            
            <div class="space-y-2">
              <div class="flex items-center">
                <input 
                  type="checkbox" 
                  id="include-advanced" 
                  bind:checked={includeAdvanced}
                  class="w-4 h-4 text-amber-600 bg-stone-100 border-stone-300 rounded focus:ring-amber-500"
                />
                <label for="include-advanced" class="ml-2 text-stone-800 font-medium">
                  Include Advanced
                </label>
              </div>
              <p class="text-stone-600 text-sm ml-6">
                Clear this option to reduce the list of vehicles, weapons, and upgrades to just the basic options.
              </p>
            </div>
            
            <div class="flex justify-end pt-4 border-t border-stone-200">
              <button
                class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors"
                on:click={() => (showSettingsModal = false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
</section>


<!-- Print-only view with vehicle cards -->
<div id="gaslands-print-view">
  <div class="sponsor-print-header">
    <h1>Gaslands: {currentSponsor?.name || 'Team'}</h1>
    <p>Total: {totalCans} cans {#if enableSponsorships}| Sponsor Abilities: {currentSponsor?.perks.join(', ')}{/if}</p>
  </div>
  
  <div class="print-card-grid">
    {#each vehicles as v}
      <div class="vehicle-card-print">
        <div class="card-header">
          <div class="card-name">{v.name}</div>
          <div class="bold">Gear</div>
        </div>
        
        <div class="card-stats">
          <div>
            <div class="bold vehicle-type">{vehicleTypes.find(vt => vt.id === v.type)?.name}</div>
            <div class="bold">Handling: {v.type === 'car' ? 3 : v.type === 'truck' ? 2 : 4}</div>
            <div class="bold">Crew: {v.type === 'car' ? 2 : v.type === 'truck' ? 3 : 1}</div>
          </div>
          
          <div class="card-gear">
            <div>Max</div>
            <div style="font-size: 1.5em;">{vehicleTypes.find(vt => vt.id === v.type)?.maxGear}</div>
          </div>
        </div>
        
        <div class="card-hull">
          <div>
            <span class="rotate90">Hull</span>
            {#each Array(Math.min(6, vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0)) as _, i}
              <span class="hull-box"></span>
            {/each}
          </div>
          {#if (vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0) > 6}
            <div style="margin-left: 30px;">
              {#each Array(Math.min(6, (vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0) - 6)) as _, i}
                <span class="hull-box"></span>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="card-weapons">
          {v.weapons.map(id => weapons.find(w => w.id === id)?.name || id).join(', ')}
          {#if v.upgrades.length > 0}
            <div style="margin-top: 5px;">
              Upgrades: {v.upgrades.map(id => upgrades.find(u => u.id === id)?.name || id).join(', ')}
            </div>
          {/if}
        </div>
        
        <div class="card-footer">
          {#if v.perks.length > 0}
            Perks: {v.perks.map(id => perks.find(p => p.id === id)?.name || "").join(', ')}
          {/if}
        </div>
      </div>
    {/each}
  </div>
  
  <!-- Perk details section -->
  <div id="perk-details-print">
    <h2>Weapons & Upgrades Details</h2>
    
    <div class="print-section">
      <h3>Weapons</h3>
      <div class="perk-list">
        {#each [...new Set(vehicles.flatMap(v => v.weapons))] as weaponId}
          {#if weapons.find(w => w.id === weaponId)}
            <div class="perk-item">
              <strong>{weapons.find(w => w.id === weaponId)?.name}</strong> - 
              {weapons.find(w => w.id === weaponId)?.cost} cans
              {#if weapons.find(w => w.id === weaponId)?.unique}
                (Unique)
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
    
    <div class="print-section">
      <h3>Upgrades</h3>
      <div class="perk-list">
        {#each [...new Set(vehicles.flatMap(v => v.upgrades))] as upgradeId}
          {#if upgrades.find(u => u.id === upgradeId)}
            <div class="perk-item">
              <strong>{upgrades.find(u => u.id === upgradeId)?.name}</strong> - 
              {upgrades.find(u => u.id === upgradeId)?.specialRules}
            </div>
          {/if}
        {/each}
      </div>
    </div>
    
    {#if enableSponsorships}
    <div class="print-section">
      <h3>Perks</h3>
      <div class="perk-list">
        {#each [...new Set(vehicles.flatMap(v => v.perks))] as perkId}
          {#if perks.find(p => p.id === perkId)}
            <div class="perk-item">
              <strong>{perks.find(p => p.id === perkId)?.name} (Level {perks.find(p => p.id === perkId)?.level})</strong> - 
              {perks.find(p => p.id === perkId)?.text}
            </div>
          {/if}
        {/each}
      </div>
    </div>
    {/if}
  </div>
  
  <!-- QR Code and footer -->
  <div class="print-footer">
    <div class="qr-code-container">
      {#if qrDataUrl}
        <img src={qrDataUrl} alt="QR Code" class="qr-code-image" />
      {:else}
        <div class="qr-code-placeholder">QR Code</div>
      {/if}
      <div class="qr-code-caption">Scan to load team</div>
    </div>
    <div class="print-footer-text">
      Generated by Gaslands Garage on {new Date().toLocaleDateString()}
    </div>
  </div>
</div>

