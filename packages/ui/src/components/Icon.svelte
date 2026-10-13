<script lang="ts" module>
  export type IconName =
    | 'home' | 'briefcase' | 'file' | 'building' | 'settings' | 'plus' | 'check' | 'clock' | 'external'
    | 'trash' | 'edit' | 'copy' | 'search' | 'alert' | 'back' | 'refresh' | 'download' | 'close' | 'sparkle' | 'help' | 'folder'
    | 'flag' | 'mail' | 'phone' | 'chat' | 'calendar' | 'task' | 'video' | 'bell' | 'arrow-in' | 'arrow-out';

  const PATHS: Record<IconName, string> = {
    home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
    briefcase: 'M3 7h18v13H3zM9 7V4h6v3M3 13h18',
    file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
    building: 'M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1M2 21h20',
    settings: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M14 4v4M8 10v4M16 16v4',
    plus: 'M12 5v14M5 12h14',
    check: 'M5 12l5 5 9-10',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    copy: 'M8 8h12v12H8zM4 16V4h12',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
    back: 'M15 5l-7 7 7 7',
    refresh: 'M20 11a8 8 0 1 0-2 6M20 5v6h-6',
    download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
    close: 'M6 6l12 12M18 6L6 18',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.7M12 17h.01',
    folder: 'M3 6h6l2 2h10v11H3z',
    sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 3v4M17 5h4',
    flag: 'M5 3v18M5 4h12l-2 4 2 4H5',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    chat: 'M4 5h16v11H9l-5 4z',
    calendar: 'M3 6h18v15H3zM3 10h18M8 3v4M16 3v4',
    task: 'M5 3h14v18H5zM9 12l2 2 4-4M9 7h6',
    video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3',
    bell: 'M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
    'arrow-in': 'M19 5L5 19M5 9v10h10',
    'arrow-out': 'M5 19L19 5M9 5h10v10',
  };
</script>

<script lang="ts">
  let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d={PATHS[name]} />
</svg>
