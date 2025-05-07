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
	};
	const { sponsors, vehicleTypes, weapons } = data;

	/* ---------- UI state ---------- */
	let sponsorId: string = sponsors[0]?.id ?? '';
	type Veh = { id: string; type: string; name: string; weapons: string[]; perks: string[] };
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
		<label class="block">
			<span class="text-lg font-bold text-stone-800 block mb-2">Choose Your Sponsor</span>
			<div class="relative">
				<select
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
										<label class="block text-xs text-stone-600 mb-1 font-semibold uppercase">Vehicle Type</label>
										<select
											bind:value={v.type}
											class="w-full p-2 border border-stone-300 rounded bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
											on:change={() => {
												const vt = vehicleTypes.find((t) => t.id === v.type)!;
												v.name = vt.name;
											}}
											aria-label="Vehicle type"
										>
											{#each vehicleTypes as vt}
												<option value={vt.id}>{vt.name}</option>
											{/each}
										</select>
									</div>
									<div class="flex-1 w-full">
										<label class="block text-xs text-stone-600 mb-1 font-semibold uppercase">Vehicle Name</label>
										<input
											bind:value={v.name}
											class="w-full p-2 border border-stone-300 rounded bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
											placeholder="Vehicle name"
											aria-label="Vehicle name"
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
							<div class="grid grid-cols-3 gap-2 text-sm bg-stone-100 p-3 rounded mt-0 mb-4">
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
									<span class="block text-xs text-stone-600 uppercase font-semibold">Weapons</span>
									<span class="font-bold text-lg">
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
									<select
										class="w-full p-2 border border-stone-300 rounded bg-white text-stone-800 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
										on:change={e => {
											const weaponId = e.target.value;
											if (weaponId) {
												addWeapon(v.id, weaponId);
												e.target.value = ""; // Reset selection
											}
										}}
										aria-label="Add a weapon"
									>
										<option value="" disabled selected>+ Add weapon</option>
										{#each weapons as w}
											<option value={w.id}>{w.name}</option>
										{/each}
									</select>
									<!-- Dropdown arrow removed -->
								</div>
							</div>
							
							<!-- Vehicle stats -->
							<div class="grid grid-cols-3 gap-2 text-sm bg-stone-100 p-3 rounded mt-3">
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
									<span class="block text-xs text-stone-600 uppercase font-semibold">Weapons</span>
									<span class="font-bold text-lg">
										{v.weapons.length} / {vehicleTypes.find(vt => vt.id === v.type)?.weaponSlots || '?'}
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
    <div class="mt-6 bg-white p-5 rounded-lg shadow-md">
      <h2 class="text-xl font-bold text-stone-800 mb-4 flex items-center">
        Import Build
      </h2>

      <div class="space-y-3">
        <p class="text-stone-600 text-sm">
          Paste a team build code below to import a shared build
        </p>
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={importString}
            class="flex-1 px-4 py-2 border border-stone-300 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="Paste encoded draft here"
            aria-label="Import team build code"
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
