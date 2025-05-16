{#if v.weapons.length === 0}
	<p class="text-stone-500 text-sm italic px-2">No weapons equipped.</p>
{:else}
	<!-- Function to check if vehicle has an upgrade with 360 capability -->
	{@const hasUpgradeWith360 = (vehicleUpgrades) => {
		return vehicleUpgrades.some(upgradeId => {
			const upgrade = upgrades.find(u => u.id === upgradeId);
			return upgrade && upgrade["360"] === true;
		});
	}}
	
	{@const findBaseWeaponId = (weaponInstanceId, parts) => {
		if (!parts) {
			parts = weaponInstanceId.split('_');
		}
		
		// Handle case with no underscores
		if (parts.length === 1) {
			return weaponInstanceId;
		}
		
		// Try increasingly longer potential base IDs until we find a match
		for (let i = parts.length - 1; i >= 1; i--) {
			const potentialBaseId = parts.slice(0, i).join('_');
			const match = weapons.find(w => w.id === potentialBaseId);
			if (match) {
				return potentialBaseId;
			}
		}
		
		// If no match found, use the default approach (all but last part)
		return parts.slice(0, -1).join('_');
	}}
	
	<ul class="space-y-1 mb-3 border border-stone-300 rounded overflow-hidden divide-y divide-stone-300">
		{#each v.weapons as weaponId, i}
			{@const parts = weaponId.split('_')}
			{@const baseWeaponId = findBaseWeaponId(weaponId, parts)}
			{@const weaponObj = weapons.find(w => w.id === baseWeaponId)}
			{@const facing = v.weaponFacings?.[weaponId] || 'front'}
			<li class="flex items-center justify-between bg-stone-50 px-3 py-2">
				<div class="flex-1">
					<span class="text-stone-700 font-medium">{weaponObj?.name || weaponId}</span>
					{#if weaponObj?.attackDice}
						<span class="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-2">🎲 {weaponObj.attackDice}</span>
					{/if}
					<div class="flex items-center mt-1">
						<span class="text-stone-500 text-xs mr-2">Facing:</span>
						<select 
							class="text-xs border border-stone-300 rounded p-1 bg-white"
							value={facing}
							on:change={e => {
								const newFacing = e.target.value;
								// Update the facing for this weapon
								vehicles = vehicles.map(vehicle => {
									if (vehicle.id === v.id) {
										return {
											...vehicle,
											weaponFacings: {
												...(vehicle.weaponFacings || {}),
												[weaponId]: newFacing
											}
										};
									}
									return vehicle;
								});
							}}
						>
							{#if weaponObj?.facing && weaponObj?.facing !== 'any'}
								<option value={weaponObj.facing}>{weaponObj.facing}</option>
							{:else if weaponObj?.crewFired}
								<!-- Crew fired weapons must be 360 -->
								<option value="360">360</option>
							{:else if weaponObj?.dropped}
								<!-- Dropped weapons must be side or rear -->
								<option value="side">side</option>
								<option value="rear">rear</option>
							{:else}
								<!-- Standard weapons -->
								<option value="front">front</option>
								<option value="side">side</option>
								<option value="rear">rear</option>
								
								<!-- If vehicle has a 360 upgrade, also allow 360 facing -->
								{#if hasUpgradeWith360(v.upgrades)}
									<option value="360">360</option>
								{/if}
							{/if}
						</select>
					</div>
				</div>
				<button
					class="p-1 h-6 w-6 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors ml-2"
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