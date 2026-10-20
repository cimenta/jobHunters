export type MarkdownTool = 'bold' | 'italic' | 'heading' | 'list' | 'link' | 'code';

/** The text after a toolbar button and the part of it to leave selected. */
export interface MarkdownEdit {
  value: string;
  start: number;
  end: number;
}

function wrap(value: string, start: number, end: number, mark: string, fallback: string): MarkdownEdit {
  const selected = value.slice(start, end) || fallback;
  return { value: value.slice(0, start) + mark + selected + mark + value.slice(end), start: start + mark.length, end: start + mark.length + selected.length };
}

/** Applies `change` to every line the selection touches; the selection then covers those lines. */
function perLine(value: string, start: number, end: number, change: (lines: string[]) => string[]): MarkdownEdit {
  const from = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
  const stop = value.indexOf('\n', end);
  const to = stop === -1 ? value.length : stop;
  const lines = change(value.slice(from, to).split('\n')).join('\n');
  return { value: value.slice(0, from) + lines + value.slice(to), start: from, end: from + lines.length };
}

/**
 * What a toolbar button of the Markdown editor does to `value` with the selection `start`..`end`: it wraps the
 * selection in marks (or inserts the marks around `fallback` when nothing is selected), or prefixes the selected lines.
 * A heading or a list that is already there is taken off again.
 */
export function applyMarkdownTool(value: string, start: number, end: number, tool: MarkdownTool, fallback: string): MarkdownEdit {
  switch (tool) {
    case 'bold':
      return wrap(value, start, end, '**', fallback);
    case 'italic':
      return wrap(value, start, end, '*', fallback);
    case 'heading':
      return perLine(value, start, end, (lines) => {
        const marked = lines.every((line) => line.startsWith('## '));
        return lines.map((line) => (marked ? line.slice(3) : line.startsWith('## ') ? line : `## ${line.replace(/^#{1,6}\s+/, '')}`));
      });
    case 'list':
      return perLine(value, start, end, (lines) => {
        const marked = lines.every((line) => line.startsWith('- '));
        return lines.map((line) => (marked ? line.slice(2) : line.startsWith('- ') ? line : `- ${line}`));
      });
    case 'link': {
      const label = value.slice(start, end) || fallback;
      const text = `[${label}](https://)`;
      const at = start + label.length + 3;
      return { value: value.slice(0, start) + text + value.slice(end), start: at, end: at + 'https://'.length };
    }
    case 'code': {
      const selected = value.slice(start, end);
      if (selected.includes('\n')) {
        const block = `\`\`\`\n${selected}\n\`\`\``;
        return { value: value.slice(0, start) + block + value.slice(end), start: start + 4, end: start + 4 + selected.length };
      }
      return wrap(value, start, end, '`', fallback);
    }
  }
}
