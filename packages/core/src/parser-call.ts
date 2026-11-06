import { ValidationError, type ErrorParams } from './errors';
import type { PageFetcher } from './jobs/fetcher';
import type { Settings } from './settings';

/** The request the Custom load button sends until the user writes their own in Settings, tab Parser. */
export const DEFAULT_PARSER_PARAMS = "{\n    'method': 'get',\n    'url': 'https://parser.example.com/load?url=%%urlencoded%%&token=%%apikey%%',\n    'headers': {},\n}";

export interface ParserValues {
  url: string;
  apikey: string;
}

export interface ParserRequest {
  url: string;
  headers: Record<string, string>;
}

/** A value of the configuration: a text, or an object of values. */
type Node = string | { [key: string]: Node };

/** %%url%% is the address of the ad, %%urlencoded%% the same encoded for a query string, %%apikey%% the key. */
function fill(text: string, values: ParserValues): string {
  return text.split('%%url%%').join(values.url).split('%%urlencoded%%').join(encodeURIComponent(values.url)).split('%%apikey%%').join(values.apikey);
}

function invalid(detail: string): never {
  throw new ValidationError('parser_params_invalid', `The parser request is not valid: ${detail}`, { detail });
}

/**
 * Reads the text of Params as the object one writes in Python or JavaScript: braces around `name: value` entries
 * separated by commas (a comma after the last one is fine), names and texts in single or double quotes, objects inside
 * objects. Nothing is run; a value that is not quoted is taken as a text.
 */
class Reader {
  private pos = 0;

  constructor(private readonly text: string) {}

  readRoot(): Record<string, Node> {
    this.skipSpace();
    const root = this.readValue();
    this.skipSpace();
    if (this.pos < this.text.length) invalid(`unexpected text "${this.text.slice(this.pos, this.pos + 20)}" after the closing brace`);
    if (typeof root === 'string') invalid('the request has to be inside braces { }');
    return root;
  }

  private skipSpace(): void {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos]!)) this.pos++;
  }

  private readValue(): Node {
    this.skipSpace();
    const ch = this.text[this.pos];
    if (ch === '{') return this.readObject();
    if (ch === '"' || ch === "'") return this.readQuoted();
    return this.readBare('value');
  }

  private readObject(): { [key: string]: Node } {
    this.pos++;
    const out: { [key: string]: Node } = {};
    for (;;) {
      this.skipSpace();
      const ch = this.text[this.pos];
      if (ch === undefined) invalid('a closing brace } is missing');
      if (ch === '}') {
        this.pos++;
        return out;
      }
      const name = ch === '"' || ch === "'" ? this.readQuoted() : this.readBare('name');
      if (name === '') invalid('an entry has no name');
      this.skipSpace();
      if (this.text[this.pos] !== ':') invalid(`the entry "${name.slice(0, 40)}" has no colon`);
      this.pos++;
      out[name] = this.readValue();
      this.skipSpace();
      if (this.text[this.pos] === ',') this.pos++;
      else if (this.text[this.pos] === undefined) invalid('a closing brace } is missing');
      else if (this.text[this.pos] !== '}') invalid(`a comma is missing after "${name.slice(0, 40)}"`);
    }
  }

  private readQuoted(): string {
    const quote = this.text[this.pos]!;
    this.pos++;
    let out = '';
    while (this.pos < this.text.length) {
      const ch = this.text[this.pos]!;
      if (ch === '\\' && this.pos + 1 < this.text.length) {
        out += this.text[this.pos + 1];
        this.pos += 2;
      } else if (ch === quote) {
        this.pos++;
        return out;
      } else {
        out += ch;
        this.pos++;
      }
    }
    return invalid('a quote is not closed');
  }

  /** A word, number or placeholder without quotes: up to the next comma, colon (names), brace or line end. */
  private readBare(what: 'name' | 'value'): string {
    const start = this.pos;
    while (this.pos < this.text.length && !(what === 'name' ? /[:,{}]/ : /[,{}\n]/).test(this.text[this.pos]!)) this.pos++;
    const token = this.text.slice(start, this.pos).trim();
    if (token === '' && what === 'value') invalid('an entry has no value');
    return token;
  }
}

function textOf(node: Node | undefined, what: string): string | undefined {
  if (node === undefined) return undefined;
  if (typeof node !== 'string') invalid(`${what} has to be a text`);
  return node;
}

/**
 * The request described by the Params of Settings: `method` (only get), `url` and `headers`, with %%url%%, %%urlencoded%%
 * and %%apikey%% filled in wherever they stand in the address or in a header value.
 */
export function parseParserRequest(template: string, values: ParserValues): ParserRequest {
  const body = template.trim().replace(/^[A-Za-z_]\w*\s*=\s*/, '').replace(/;$/, '');
  const config = new Reader(body).readRoot();
  for (const key of Object.keys(config)) if (!['method', 'url', 'headers'].includes(key)) invalid(`"${key}" is not supported (use method, url and headers)`);
  const method = textOf(config.method, 'method');
  if (method !== undefined && method.toLowerCase() !== 'get') invalid('only the method get is supported');
  const rawUrl = textOf(config.url, 'url');
  if (rawUrl === undefined || rawUrl.trim() === '') invalid('the entry url is missing');
  const url = fill(rawUrl!.trim(), values);
  if (!/^https?:\/\/\S+$/i.test(url)) invalid('url has to be a web link starting with http:// or https://');
  const headers: Record<string, string> = {};
  const rawHeaders = config.headers;
  if (rawHeaders !== undefined) {
    if (typeof rawHeaders === 'string') invalid('headers has to be an object { }');
    for (const [name, value] of Object.entries(rawHeaders as Record<string, Node>)) headers[name] = fill(textOf(value, `the header ${name}`)!, values);
  }
  return { url, headers };
}

/** The most characters of a parser answer that the window of a failed call shows. */
export const CUSTOM_LOAD_BODY_MAX = 20000;

/** Stands for the API key in what a failed call shows. */
export const HIDDEN_KEY = '•••';

/** What the window of a failed Custom load shows: why, what was sent and what came back (the API key is hidden). */
export interface CustomLoadFailure {
  code: 'parser_call_failed' | 'parser_empty';
  params: ErrorParams;
  request: { method: string; url: string; headers: Record<string, string> };
  /** status 0 means no answer arrived; error then says why when it is known. */
  response: { status: number; body: string; truncated: boolean; error: string };
}

export interface CustomLoadResult {
  /** The HTML or text the parser answered; empty when the call failed. */
  text: string;
  failure?: CustomLoadFailure;
}

/**
 * Custom load: sends the request of Params (Settings, tab Parser) for the address of an ad. The answer of the parser
 * is meant for the text box of Add job. A request that cannot be built throws; a call that was sent and failed
 * comes back as `failure`, with the request and the answer for the user to read.
 */
export function customLoad(url: string, settings: Pick<Settings, 'parser_params' | 'parser_apikey'>, fetcher: PageFetcher): CustomLoadResult {
  const request = parseParserRequest(settings.parser_params, { url, apikey: settings.parser_apikey });
  const key = settings.parser_apikey;
  const hide = (text: string): string => {
    if (key === '') return text;
    const encoded = encodeURIComponent(key);
    return text.split(key).join(HIDDEN_KEY).split(encoded).join(HIDDEN_KEY);
  };
  const shown = {
    method: 'GET',
    url: hide(request.url),
    headers: Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name, hide(value)])),
  };
  const answer = fetcher.fetchApi
    ? fetcher.fetchApi(request.url, request.headers)
    : { status: 0, finalUrl: request.url, html: '', error: 'This backend cannot call a parser' };
  const body = hide(answer.html);
  const response = { status: answer.status, body: body.slice(0, CUSTOM_LOAD_BODY_MAX), truncated: body.length > CUSTOM_LOAD_BODY_MAX, error: hide(answer.error ?? '') };
  if (answer.status !== 200) return { text: '', failure: { code: 'parser_call_failed', params: { status: answer.status === 0 ? '–' : answer.status }, request: shown, response } };
  if (answer.html.trim() === '') return { text: '', failure: { code: 'parser_empty', params: {}, request: shown, response } };
  return { text: answer.html };
}
