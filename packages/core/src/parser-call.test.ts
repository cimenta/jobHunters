import { describe, expect, it } from 'vitest';
import type { PageFetcher } from './jobs/fetcher';
import { errorOf } from './testing/errors';
import { FakePageFetcher } from './testing/fake-fetcher';
import { customLoad, CUSTOM_LOAD_BODY_MAX, DEFAULT_PARSER_PARAMS, parseParserRequest } from './parser-call';
import { parseSettings } from './settings';

// Invented data only.

const VALUES = { url: 'https://jobs.example/ad/1?a=1&b=2#x', apikey: 'key-123' };
const ENCODED = 'https%3A%2F%2Fjobs.example%2Fad%2F1%3Fa%3D1%26b%3D2%23x';

describe('parseParserRequest', () => {
  it('reads the example of Settings: the address with the encoded ad address and the key, and no headers', () => {
    expect(parseParserRequest(DEFAULT_PARSER_PARAMS, VALUES)).toEqual({
      url: `https://parser.example.com/load?url=${ENCODED}&token=key-123`,
      headers: {},
    });
  });

  it('fills in the three placeholders in the address and in header values, and keeps a raw %%url%%', () => {
    const request = parseParserRequest(
      "{ 'url': 'https://parser.example.com/load?u=%%url%%', 'headers': { 'Authorization': 'Bearer %%apikey%%', 'X-Ad': \"%%urlencoded%%\" } }",
      { url: 'https://jobs.example/a', apikey: 'k$&1' },
    );
    expect(request).toEqual({
      url: 'https://parser.example.com/load?u=https://jobs.example/a',
      headers: { Authorization: 'Bearer k$&1', 'X-Ad': 'https%3A%2F%2Fjobs.example%2Fa' },
    });
  });

  it('accepts a "config =" prefix, a semicolon, double quotes, unquoted names and values, a last comma, line breaks and the method in any case', () => {
    const request = parseParserRequest('config = {\n  method: GET,\n  "url": "https://parser.example.com/x?t=%%apikey%%",\n  headers: { Accept: text/html, },\n};', VALUES);
    expect(request).toEqual({ url: 'https://parser.example.com/x?t=key-123', headers: { Accept: 'text/html' } });
    expect(parseParserRequest("{'url': 'https://parser.example.com/it\\'s'}", VALUES).url).toBe("https://parser.example.com/it's");
  });

  it('names what is wrong and never runs anything', () => {
    const detail = (template: string) => {
      const error = errorOf(() => parseParserRequest(template, VALUES));
      expect(error.code).toBe('parser_params_invalid');
      return String(error.params.detail);
    };
    expect(detail('url=1')).toContain('braces');
    expect(detail("{'url' 'x'}")).toContain('no colon');
    expect(detail("{'url': 'https://p.example.com'")).toContain('closing brace');
    expect(detail("{'url': 'https://p.example.com' 'method': 'get'}")).toContain('comma');
    expect(detail("{'url': 'abc}")).toContain('quote');
    expect(detail("{'method': 'get'}")).toContain('url is missing');
    expect(detail("{'url': 'ftp://p.example.com'}")).toContain('web link');
    expect(detail("{'url': 'https://p.example.com', 'method': 'post'}")).toContain('only the method get');
    expect(detail("{'url': 'https://p.example.com', 'params': {}}")).toContain('"params" is not supported');
    expect(detail("{'url': 'https://p.example.com', 'headers': 'x'}")).toContain('headers has to be an object');
    expect(detail("{'url': 'https://p.example.com', 'headers': {'A': {}}}")).toContain('has to be a text');
    expect(detail("{'url': encodeURIComponent(%%url%%)}")).toContain('web link');
    expect(detail("{'url': 'https://p.example.com'} extra")).toContain('after the closing brace');
  });
});

describe('customLoad', () => {
  const settings = { parser_params: DEFAULT_PARSER_PARAMS, parser_apikey: 'key-123' };
  const call = `https://parser.example.com/load?url=${ENCODED}&token=key-123`;
  const run = (fetcher: PageFetcher, change: Partial<typeof settings> = {}) => customLoad(VALUES.url, { ...settings, ...change }, fetcher);

  it('sends the request with its headers and returns the answer', () => {
    const fetcher = new FakePageFetcher({ [call]: { status: 200, html: '<html>Engineer at Acme</html>' } });
    const params = "{'url': 'https://parser.example.com/load?url=%%urlencoded%%&token=%%apikey%%', 'headers': {'Accept': 'text/html'}}";
    expect(run(fetcher, { parser_params: params })).toEqual({ text: '<html>Engineer at Acme</html>' });
    expect(fetcher.apiCalls).toEqual([{ url: call, headers: { Accept: 'text/html' } }]);
    expect(fetcher.calls).toEqual([]);
  });

  it('refuses a request that cannot be built before anything is sent', () => {
    const fetcher = new FakePageFetcher();
    expect(errorOf(() => run(fetcher, { parser_params: 'oops' })).code).toBe('parser_params_invalid');
    expect(fetcher.apiCalls).toEqual([]);
  });

  it('returns the request and the answer of a call that failed, with the API key hidden', () => {
    const fetcher = new FakePageFetcher({ [call]: { status: 500, html: 'Server error for token key-123' } });
    const params = "{'url': 'https://parser.example.com/load?url=%%urlencoded%%&token=%%apikey%%', 'headers': {'Authorization': 'Bearer %%apikey%%'}}";
    expect(run(fetcher, { parser_params: params })).toEqual({
      text: '',
      failure: {
        code: 'parser_call_failed',
        params: { status: 500 },
        request: { method: 'GET', url: `https://parser.example.com/load?url=${ENCODED}&token=•••`, headers: { Authorization: 'Bearer •••' } },
        response: { status: 500, body: 'Server error for token •••', truncated: false, error: '' },
      },
    });
  });

  it('reports a missing answer with its reason, an empty answer and a long body that is cut', () => {
    const none = run({ fetch: () => ({ status: 200, finalUrl: '', html: '' }) });
    expect(none.failure).toMatchObject({ code: 'parser_call_failed', params: { status: '–' }, response: { status: 0, error: 'This backend cannot call a parser' } });
    const down = run({ fetch: () => ({ status: 200, finalUrl: '', html: '' }), fetchApi: () => ({ status: 0, finalUrl: '', html: '', error: 'DNS error: parser.example.com' }) });
    expect(down.failure?.response).toMatchObject({ status: 0, error: 'DNS error: parser.example.com' });
    const empty = run(new FakePageFetcher({ [call]: { status: 200, html: '  ' } }));
    expect(empty.failure).toMatchObject({ code: 'parser_empty', response: { status: 200, body: '  ' } });
    const long = run(new FakePageFetcher({ [call]: { status: 502, html: 'x'.repeat(CUSTOM_LOAD_BODY_MAX + 5) } }));
    expect(long.failure?.response).toMatchObject({ truncated: true });
    expect(long.failure?.response.body).toHaveLength(CUSTOM_LOAD_BODY_MAX);
  });
});

describe('parser settings', () => {
  it('start with the example request and keep what is stored', () => {
    const { settings, warnings } = parseSettings({});
    expect(warnings).toEqual([]);
    expect(settings.parser_name).toBe('');
    expect(settings.parser_params).toBe(DEFAULT_PARSER_PARAMS);
    expect(settings.parser_apikey).toBe('');
    const stored = parseSettings({ parser_name: ' Acme ', parser_params: "{'url': 'https://p.example.com'}\n", parser_apikey: ' k ' }).settings;
    expect(stored.parser_name).toBe('Acme');
    expect(stored.parser_params).toBe("{'url': 'https://p.example.com'}\n");
    expect(stored.parser_apikey).toBe('k');
  });
});
