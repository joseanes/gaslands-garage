<script lang="ts">
  import { user, signInWithGoogle, signOutUser } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  
  let showDropdown = false;
  let isLoading = false;
  
  // Handle Google sign in
  const handleSignIn = async () => {
    isLoading = true;
    const result = await signInWithGoogle();
    isLoading = false;
    if (!result.success) {
      alert('Failed to sign in with Google. Please try again.');
    }
    showDropdown = false;
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    isLoading = true;
    const result = await signOutUser();
    isLoading = false;
    if (!result.success) {
      alert('Failed to sign out. Please try again.');
    }
    showDropdown = false;
  };
  
  // Close dropdown when clicking outside
  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.auth-container')) {
        showDropdown = false;
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="auth-container relative">
  {#if $user}
    <!-- User is signed in -->
    <button 
      type="button" 
      class="flex items-center profile-button"
      on:click={() => showDropdown = !showDropdown}
    >
      {#if $user.photoURL}
        <img src={$user.photoURL} alt="Profile" class="w-8 h-8 rounded-full mr-2" />
      {:else}
        <div class="w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center mr-2">
          {$user.displayName?.charAt(0)?.toUpperCase() || $user.email?.charAt(0)?.toUpperCase() || '?'}
        </div>
      {/if}
      <span class="hidden md:inline text-white">{$user.displayName || $user.email}</span>
    </button>
    
    {#if showDropdown}
      <div class="dropdown absolute right-0 top-full mt-2 bg-white shadow-lg rounded-lg z-20 p-2 w-48 dark:bg-gray-800" transition:fade={{ duration: 150 }}>
        <div class="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
          Signed in as <strong>{$user.displayName || $user.email}</strong>
        </div>
        <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
        <button 
          type="button" 
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          on:click={handleSignOut}
          disabled={isLoading}
        >
          {isLoading ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    {/if}
  {:else}
    <!-- User is not signed in -->
    <button 
      type="button"
      class="flex items-center justify-center sign-in-button"
      on:click={handleSignIn}
      disabled={isLoading}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      <span class="hidden md:inline">{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
      <span class="md:hidden">Sign in</span>
    </button>
  {/if}
</div>

<style>
  .profile-button {
    background: transparent;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    cursor: pointer;
  }
  
  .profile-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .sign-in-button {
    color: white;
    background-color: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .sign-in-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .dropdown {
    min-width: 240px;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
</style>