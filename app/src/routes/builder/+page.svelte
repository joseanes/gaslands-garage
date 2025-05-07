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

	function addVehicle(type = vehicleTypes[0]?.id) {
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

	let qrDataUrl: string | null = null;   // toggles modal

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

	/* ---------- draft & validation ---------- */
	$: currentDraft = { sponsor: sponsorId, vehicles } satisfies Draft;
	let validation: Validation = { cans: 0, errors: [], vehicleReports: [] };
	$: validateDraft(currentDraft).then((r) => (validation = r));
	$: totalCans = validation.cans;
	$: teamErrors = validation.errors;
	
	// Get available perks for the current sponsor
	$: currentSponsor = sponsors.find(s => s.id === sponsorId);
	$: availablePerks = perks.filter(p => currentSponsor?.perks.includes(p.id));

	/* ---------- import box ---------- */
	let importString = '';
</script>

<section class="max-w-4xl mx-auto p-6 bg-stone-100 min-h-screen">
	<header class="mb-8 text-center">
		<h1 class="text-4xl font-extrabold text-stone-800 tracking-tight">
			<span class="text-amber-600">Gaslands</span> Garage
		</h1>
		<p class="text-stone-600 mt-2">Build your team of deadly vehicles and dominate the wasteland</p>
	</header>

	<!-- Sponsor selector -->
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
											{#each vehicleTypes as vt}
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
										{#each weapons as w}
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
										{#each upgrades as u}
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

        <!-- Actions Section -->
        <div class="mt-6 flex flex-wrap gap-3">
          <button
            class="flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-md"
            on:click={async () => {
              await navigator.clipboard.writeText(encodeDraft(currentDraft));
              alert('Draft copied to clipboard!');
            }}
          >
            Copy Draft
          </button>

          <button
            class="flex items-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors shadow-md"
            on:click={() => {
              const encoded = encodeDraft(currentDraft);
              goto(`?draft=${encoded}`, { replaceState: true });
            }}
          >
            Share Link
          </button>

          <button
            class="flex items-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors shadow-md"
            on:click={async () => {
              qrDataUrl = await draftToDataURL(currentDraft);
            }}
          >
            Generate QR Code
          </button>

          <button
            class="flex items-center px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors shadow-md print:hidden"
            on:click={() => {
              window.print();
            }}
          >
            Print Team
          </button>
        </div>
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
          <button
            class="mt-4 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
            on:click={() => (qrDataUrl = null)}
          >
            Close
          </button>
        </div>
      </div>
    {/if}

    <!-- Import section -->
    <div class="mt-6 bg-white p-5 rounded-lg shadow-md print:hidden">
      <h2 class="text-xl font-bold text-stone-800 mb-4 flex items-center">
        Import Build
      </h2>

      <div class="space-y-3">
        <p class="text-stone-600 text-sm">
          Paste a team build code below to import a shared build
        </p>
        <div class="flex gap-2">
          <label for="import-draft" class="sr-only">Import team build code</label>
          <input
            id="import-draft"
            type="text"
            bind:value={importString}
            class="flex-1 px-4 py-2 border border-stone-300 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="Paste encoded draft here"
          />
          <button
            class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors shadow-md flex items-center whitespace-nowrap"
            on:click={() => {
              const draft = decodeDraft(importString.trim());
              if (draft) {
                sponsorId = draft.sponsor;
                vehicles = draft.vehicles as Veh[];
                importString = '';
              } else {
                alert('Invalid draft string');
              }
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
</section>

<!-- Print styles -->
<style>
  @media print {
    /* Hide elements that shouldn't be printed */
    header button, 
    button[aria-label="Remove vehicle"],
    button[aria-label="Remove weapon"],
    button[aria-label="Remove upgrade"],
    button[aria-label="Remove perk"],
    .relative select,
    #import-draft,
    .flex.gap-2 button,
    .bg-red-50,
    .bg-green-50 {
      display: none !important;
    }
    
    /* Page formatting */
    section {
      background-color: white !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    
    /* Reset background colors for printing */
    .bg-stone-100, .bg-stone-200, .bg-stone-300, .bg-white {
      background-color: white !important;
      box-shadow: none !important;
    }
    
    /* Team heading */
    header h1 {
      font-size: 24pt !important;
      margin-bottom: 10px !important;
    }
    
    header p {
      font-size: 12pt !important;
    }
    
    /* Ensure each vehicle gets proper space */
    .grid.grid-cols-1, .grid.md\\:grid-cols-2 {
      display: block !important;
    }
    
    /* Vehicle cards formatting */
    .bg-stone-200 {
      border: 1px solid #ccc !important;
      page-break-inside: avoid;
      margin-bottom: 20px !important;
    }
    
    /* Make text more readable on print */
    .text-stone-600, .text-stone-500, .text-stone-700 {
      color: black !important;
    }
    
    /* Add page footer */
    @page {
      margin: 0.5cm;
    }
    
    /* Hide the normal stats grids */
    .grid.grid-cols-7, .grid.grid-cols-4, .grid.grid-cols-6 {
      display: none !important;
    }
    
    /* Clean sections */
    .p-4, .p-5, .p-6 {
      padding: 0.25cm !important;
    }
    
    /* Print-specific team summary */
    #team-summary-print {
      display: block !important;
      margin-top: 30px !important;
      border-top: 1px solid #999 !important;
      padding-top: 10px !important;
      font-size: 12pt !important;
    }
    
    /* Text formatting for print */
    #team-summary-print h2 {
      font-size: 18pt !important;
      margin-bottom: 15px !important;
    }
    
    #team-summary-print h3 {
      font-size: 14pt !important;
      margin-top: 15px !important;
      margin-bottom: 5px !important;
      border-bottom: 1px solid #ccc !important;
    }
    
    #team-summary-print p {
      margin: 5px 0 !important;
    }
    
    #team-summary-print ul {
      margin-left: 20px !important;
      margin-bottom: 10px !important;
    }
    
    #team-summary-print ul li {
      margin-bottom: 3px !important;
    }
    
    .vehicle-print-summary {
      margin-bottom: 20px !important;
      page-break-inside: avoid !important;
    }
    
    .print-footer {
      margin-top: 30px !important;
      font-size: 10pt !important;
      text-align: center !important;
      color: #666 !important;
    }
  }
  
  #team-summary-print {
    display: none;
  }
</style>

<!-- Print-only team summary that appears at the bottom of the printed page -->
<div id="team-summary-print">
  <div class="sponsor-header-print">
    <h2>Team Summary: {currentSponsor?.name || 'Team'} ({totalCans} cans)</h2>
    <p class="sponsor-header-details">Sponsor Ability: Vehicles in this team can use the {currentSponsor?.name || 'sponsor'}'s perks ({currentSponsor?.perks.length || 0} available)</p>
  </div>
  {#each vehicles as v}
    <div class="vehicle-print-summary">
      <h3>{v.name} ({vehicleTypes.find(vt => vt.id === v.type)?.name})</h3>
      <p><strong>Hull Points:</strong> {vehicleTypes.find(vt => vt.id === v.type)?.maxHull || '?'}</p>
      <p><strong>Max Gear:</strong> {vehicleTypes.find(vt => vt.id === v.type)?.maxGear || '?'}</p>
      <p><strong>Cost:</strong> {validation.vehicleReports.find(r => r.vehicleId === v.id)?.cans || '?'} cans</p>
      
      {#if v.weapons.length > 0}
        <p><strong>Weapons:</strong> {v.weapons.map(id => weapons.find(w => w.id === id)?.name || id).join(', ')}</p>
      {/if}
      {#if v.upgrades.length > 0}
        <p><strong>Upgrades:</strong> {v.upgrades.map(id => upgrades.find(u => u.id === id)?.name || id).join(', ')}</p>
        <ul>
          {#each v.upgrades as upgradeId}
            {#if upgrades.find(u => u.id === upgradeId)?.specialRules}
              <li><strong>{upgrades.find(u => u.id === upgradeId)?.name}:</strong> {upgrades.find(u => u.id === upgradeId)?.specialRules}</li>
            {/if}
          {/each}
        </ul>
      {/if}
      {#if v.perks.length > 0}
        <p><strong>Perks:</strong></p>
        <ul>
          {#each v.perks as perkId}
            {#if perks.find(p => p.id === perkId)}
              <li><strong>{perks.find(p => p.id === perkId)?.name} (Level {perks.find(p => p.id === perkId)?.level}):</strong> {perks.find(p => p.id === perkId)?.text}</li>
            {/if}
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
  <p class="print-footer">Generated by Gaslands Garage on {new Date().toLocaleDateString()}</p>
</div>
