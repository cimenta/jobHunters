<script lang="ts">
  interface Props {
    text: string;
    ui?: string;
  }
  let { text, ui }: Props = $props();
</script>

<span class="tag" role="status" data-ui={ui}><i class="spin" aria-hidden="true"></i>{text}</span>
<span class="bar" aria-hidden="true"><i></i></span>

<style>
  .tag { display: flex; align-items: center; gap: var(--space-2); color: var(--accent); font-weight: 600; font-size: var(--text-s); }
  .spin { flex: none; width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; }
  .bar { display: block; height: 3px; border-radius: 2px; background: var(--border); overflow: hidden; }
  .bar i { display: block; height: 100%; width: 40%; background: var(--accent); animation: slide 1.1s ease-in-out infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slide { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }
  @media (prefers-reduced-motion: reduce) { .spin, .bar i { animation-duration: 3s; } }
</style>
