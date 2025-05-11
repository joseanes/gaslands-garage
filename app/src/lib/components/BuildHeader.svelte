<script lang="ts">
    // BuildHeader.svelte - A component to display vehicle build information in the header

    // Props
    export let vehicleCost: number;
    export let usedBuildSlots: number;
    export let maxBuildSlots: number;
</script>

<div class="flex items-center gap-2 self-start">
    <!-- Vehicle cost badge -->
    <div class="bg-amber-600 text-white px-3 py-1 rounded-md mr-2 text-sm font-semibold shadow-sm">
        {typeof vehicleCost === 'number' ? vehicleCost : '?'} cans
    </div>
    
    <!-- Build slots badge -->
    <div class="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-semibold shadow-sm flex items-center">
        <span class="mr-1">Slots:</span>
        <span>{usedBuildSlots}/{maxBuildSlots}</span>
    </div>
</div>