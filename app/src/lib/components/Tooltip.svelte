<script>
  import { onMount } from 'svelte';
  
  export let text = '';
  export let content = '';
  
  let tooltipElement;
  let tooltipContent;
  let position = { top: 0, left: 0 };
  let showTooltip = false;
  
  function positionTooltip() {
    if (!tooltipElement || !tooltipContent) return;
    
    const rect = tooltipElement.getBoundingClientRect();
    const tooltipRect = tooltipContent.getBoundingClientRect();
    
    // Calculate position centered above the element
    position = {
      left: rect.left + rect.width / 2 - tooltipRect.width / 2,
      top: rect.top - tooltipRect.height - 10
    };
    
    // Adjust if tooltip would appear off-screen
    if (position.left < 10) {
      position.left = 10;
    } else if (position.left + tooltipRect.width > window.innerWidth - 10) {
      position.left = window.innerWidth - tooltipRect.width - 10;
    }
    
    if (position.top < 10) {
      // If tooltip would appear above the viewport, position it below the element
      position.top = rect.bottom + 10;
    }
  }
  
  function handleMouseEnter() {
    showTooltip = true;
    setTimeout(positionTooltip, 0);
  }
  
  function handleMouseLeave() {
    showTooltip = false;
  }
  
  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showTooltip = !showTooltip;
      if (showTooltip) {
        setTimeout(positionTooltip, 0);
      }
    }
    if (event.key === 'Escape' && showTooltip) {
      showTooltip = false;
    }
  }
  
  onMount(() => {
    window.addEventListener('scroll', () => {
      if (showTooltip) positionTooltip();
    });
    
    window.addEventListener('resize', () => {
      if (showTooltip) positionTooltip();
    });
  });
</script>

<span 
  bind:this={tooltipElement}
  class="tooltip-trigger"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  on:keydown={handleKeyDown}
  role="button"
  tabindex="0"
  aria-expanded={showTooltip}
  aria-label="Show information about {text}"
>
  {text}
  
  {#if showTooltip}
    <div 
      bind:this={tooltipContent}
      class="tooltip-content"
      style="left: {position.left}px; top: {position.top}px;"
      role="tooltip"
      aria-live="polite"
    >
      <div class="tooltip-arrow"></div>
      <div class="tooltip-inner">
        {#if content.includes('<p>') || content.includes('<strong>')}
          {@html content}
        {:else}
          {content}
        {/if}
      </div>
    </div>
  {/if}
</span>

<style>
  .tooltip-trigger {
    position: relative;
    display: inline-block;
    cursor: help;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    color: #d97706; /* amber-600 */
    font-weight: 500;
  }
  
  .tooltip-trigger:hover {
    color: #f59e0b; /* amber-500 */
  }
  
  .tooltip-content {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
  }
  
  .tooltip-inner {
    background-color: #1f2937; /* dark gray-800 */
    color: white;
    text-align: left;
    padding: 8px 12px;
    border-radius: 6px;
    width: 300px;
    max-width: 80vw;
    font-size: 0.85rem;
    line-height: 1.4;
    font-weight: normal;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    border: 1px solid #f59e0b; /* amber-500 */
  }
  
  .tooltip-arrow {
    position: absolute;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid #1f2937;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
  }
</style>