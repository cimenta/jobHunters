const KEY = 'jobhunters.showIds';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether the identifier labels (the `data-ui` attributes) are shown on the screen. */
export const ids = $state({ visible: read() });

export function setIdsVisible(visible: boolean): void {
  ids.visible = visible;
  try {
    localStorage.setItem(KEY, visible ? '1' : '0');
  } catch {
    // Storage can be blocked; the choice then only lasts until the page is closed.
  }
}
