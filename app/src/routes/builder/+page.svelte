<script lang="ts">
	/* ---------- imports ---------- */
	import { nanoid } from 'nanoid';
	import { validateDraft } from '$lib/validate';
	import type { Draft, Validation } from '$lib/validate/model';
	import { encodeDraft, decodeDraft } from '$lib/draft/io';
	import { goto } from '$app/navigation';
    import { draftToDataURL } from '$lib/draft/qr';

  let qrDataUrl: string | null = null;   // toggles modal
  

	/* ---------- server data ---------- */
	export let data: {
		sponsors: typeof import('$lib/rules/types').Sponsor[];
		vehicleTypes: typeof import('$lib/rules/types').Vehicle[];
	};
	const { sponsors, vehicleTypes } = data;

	/* ---------- UI state ---------- */
	let sponsorId: string = sponsors[0].id;

	type Veh = {
		id: string;
		type: string;
		name: string;
		weapons: string[];
		perks: string[];
	};

	let vehicles: Veh[] = [];

	function addVehicle(type = vehicleTypes[0].id) {
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

<section class="max-w-3xl mx-auto p-6 space-y-6">
	<h1 class="text-3xl font-bold">Gaslands Garage</h1>

	<!-- Sponsor selector -->
	<label class="block">
		<span class="font-semibold">Sponsor</span>
		<select bind:value={sponsorId} class="mt-1 px-3 py-2 border rounded w-full">
			{#each sponsors as s}
				<option value={s.id}>{s.name}</option>
			{/each}
		</select>
	</label>

	<!-- Vehicle list -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold">Vehicles</h2>
			<button
				class="px-3 py-1 rounded bg-indigo-600 text-white"
				on:click={() => addVehicle()}
			>
				+ Add
			</button>
		</div>

		{#if vehicles.length === 0}
			<p class="text-gray-500">No vehicles yet.</p>
		{/if}

		{#each vehicles as v (v.id)}
			<div class="flex items-center gap-2 border p-2 rounded">
				<select
					bind:value={v.type}
					class="flex-1 p-1 border rounded"
					on:change={() => {
						const vt = vehicleTypes.find((t) => t.id === v.type)!;
						v.name = vt.name;
					}}
				>
					{#each vehicleTypes as vt}
						<option value={vt.id}>{vt.name}</option>
					{/each}
				</select>
				<input bind:value={v.name} class="flex-1 p-1 border rounded" />
				<button
					class="text-red-600"
					on:click={() => removeVehicle(v.id)}
					title="Remove vehicle"
				>
					✖
				</button>
			</div>
		{/each}
	</div>

	<!-- Totals / legality -->
	<div class="border-t pt-4 space-y-3">
		<p class="text-lg font-semibold">
			Total cans: <span class="text-indigo-600">{totalCans}</span>
		</p>

		{#if teamErrors.length === 0}
			<p class="px-3 py-2 rounded bg-green-100 text-green-800">✓ All selections legal</p>
		{:else}
			<div class="px-3 py-2 rounded bg-red-100 text-red-800">
				✗ Illegal build:
				<ul class="list-disc ml-6">
					{#each teamErrors as err}
						<li>{err}</li>
					{/each}
				</ul>
			</div>
		{/if}

<!-- Export / share buttons -->
<div class="flex gap-3">
  <button
    class="px-3 py-1 rounded bg-sky-600 text-white"
    on:click={async () => {
      await navigator.clipboard.writeText(encodeDraft(currentDraft));
      alert('Draft copied to clipboard!');
    }}
  >
    Copy draft
  </button>

  <button
    class="px-3 py-1 rounded bg-emerald-600 text-white"
    on:click={() => {
      const encoded = encodeDraft(currentDraft);
      goto(`?draft=${encoded}`, { replaceState: true });
    }}
  >
    Share link
  </button>

  <!-- NEW: QR button -->
  <button
    class="px-3 py-1 rounded bg-teal-600 text-white"
    on:click={async () => {
      console.log('generating QR…');
      qrDataUrl = await draftToDataURL(currentDraft);
      console.log('QR ready');
    }}
  >
    QR code
  </button>
</div>

<!-- QR modal -->
{#if qrDataUrl}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center"
    on:click={() => (qrDataUrl = null)}
  >
    <div class="bg-white p-4 rounded shadow" on:click|stopPropagation>
      <img src={qrDataUrl} alt="draft QR code" class="mx-auto" />
      <p class="mt-2 text-center text-sm text-gray-600">
        tap outside to close
      </p>
    </div>
  </div>
{/if}


		<!-- Manual import -->
		<label class="block mt-4">
			<span class="font-semibold">Import draft string</span>
			<input
				type="text"
				bind:value={importString}
				class="mt-1 w-full border rounded px-3 py-1"
				placeholder="paste encoded draft here"
			/>
			<button
				class="mt-1 px-3 py-1 bg-indigo-600 text-white rounded"
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
				Load
			</button>
		</label>
	</div>
</section>
