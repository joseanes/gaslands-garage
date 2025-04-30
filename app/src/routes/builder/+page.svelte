<script lang="ts">
  import { sponsors, vehicleTypes } from '$lib/mock-rules';
  import { nanoid } from 'nanoid';

  // ---- state ----
  let sponsorId: string = sponsors[0].id;
  type Veh = { id: string; type: string; name: string; cost: number };
  let vehicles: Veh[] = [];

  // ---- helpers ----
  function addVehicle(type = vehicleTypes[0].id) {
    const vt = vehicleTypes.find(v => v.id === type)!;
    vehicles = [
      ...vehicles,
      { id: nanoid(6), type: vt.id, name: `New ${vt.name}`, cost: vt.baseCost }
    ];
  }
  function removeVehicle(id: string) {
    vehicles = vehicles.filter(v => v.id !== id);
  }

  $: totalCans =
    sponsors.find(s => s.id === sponsorId)!.starterCans +
    vehicles.reduce((sum, v) => sum + v.cost, 0);
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
      <button class="px-3 py-1 rounded bg-indigo-600 text-white"
              on:click={() => addVehicle()}>
        + Add
      </button>
    </div>

    {#if vehicles.length === 0}
      <p class="text-gray-500">No vehicles yet.</p>
    {/if}

    {#each vehicles as v (v.id)}
      <div class="flex items-center gap-2 border p-2 rounded">
        <select bind:value={v.type}
                on:change={() => v.cost = vehicleTypes.find(t => t.id === v.type)!.baseCost}
                class="flex-1 p-1 border rounded">
          {#each vehicleTypes as vt}
            <option value={vt.id}>{vt.name}</option>
          {/each}
        </select>
        <input bind:value={v.name} class="flex-1 p-1 border rounded" />
        <span class="w-10 text-center">{v.cost}</span>
        <button class="text-red-600" on:click={() => removeVehicle(v.id)}>✖</button>
      </div>
    {/each}
  </div>

  <!-- Totals -->
  <div class="border-t pt-4">
    <p class="text-lg font-semibold">
      Total cans:&nbsp;<span class="text-indigo-600">{totalCans}</span>
    </p>
    <p class="mt-2 px-3 py-2 rounded bg-green-100 text-green-800">
      ✓ All selections legal (mock)
    </p>
  </div>
</section>

