import { describe, expect, it } from 'vitest';
import {
  CELL_LIMIT, decodeEntities, detectLanguage, elementsInnerHtml, foldDiacritics, htmlToText, jsonLdObjects,
  metaContent, parseAttrs, stripTags, titleTag, truncateForCell,
} from './html';

describe('decodeEntities', () => {
  it('decodes named and numeric entities and leaves unknown ones alone', () => {
    expect(decodeEntities('Tom &amp; &lt;b&gt; &#65; &#x42; &nbsp;x &unknown; &constructor;')).toBe('Tom & <b> A B  x &unknown; &constructor;');
  });
});

describe('htmlToText', () => {
  it('keeps paragraph and list structure, drops scripts and tags, decodes once', () => {
    const html = '<p>Hello&nbsp;<b>world</b></p><script>alert(1)</script><ul><li>One</li><li>Two</li></ul>';
    expect(htmlToText(html)).toBe('Hello world\n- One\n- Two');
  });
  it('turns <br> into line breaks and collapses blank lines', () => {
    expect(htmlToText('a<br><br><br><br>b')).toBe('a\n\nb');
  });
  it('does not execute or keep markup that was escaped in the source', () => {
    expect(htmlToText('&lt;script&gt;x&lt;/script&gt;')).toBe('<script>x</script>');
  });
  it('removes svg and comments', () => {
    expect(htmlToText('<svg><path d="M0"/></svg><!-- hi -->Text')).toBe('Text');
  });
});

describe('stripTags / titleTag / metaContent', () => {
  it('strips tags', () => {
    expect(stripTags('<b>a</b> <i>b</i>')).toBe('a b');
  });
  it('reads the title', () => {
    expect(titleTag('<head><title>  A &amp; B \n</title></head>')).toBe('A & B');
  });
  it('reads meta content regardless of attribute order', () => {
    const html = '<meta content="A &amp; B" property="og:title"><meta name="description" content="D">';
    expect(metaContent(html, 'og:title')).toBe('A & B');
    expect(metaContent(html, 'description')).toBe('D');
    expect(metaContent(html, 'og:url')).toBe('');
  });
  it('parses attributes with different quoting', () => {
    expect(parseAttrs(`<a href="x" class='y' data-n=3 disabled>`)).toMatchObject({ href: 'x', class: 'y', 'data-n': '3' });
  });
});

describe('jsonLdObjects', () => {
  it('flattens @graph and arrays, skips invalid blocks', () => {
    const html = [
      '<script type="application/ld+json">{"@graph":[{"@type":"A"},{"@type":"B"}]}</script>',
      '<script type="application/ld+json">not json</script>',
      '<script type="application/ld+json">[{"@type":"C"}]</script>',
    ].join('');
    expect(jsonLdObjects(html).map((o) => o['@type'])).toEqual([undefined, 'A', 'B', 'C']);
  });
});

describe('elementsInnerHtml', () => {
  it('returns the inner html of matching elements, handling nesting', () => {
    const html = '<div class="a"><div>x</div>y</div><div class="a">z</div><div class="b">q</div>';
    expect(elementsInnerHtml(html, /class="a"/)).toEqual(['<div>x</div>y', 'z']);
  });
  it('ignores void and self-closing tags and finds the first heading', () => {
    expect(elementsInnerHtml('<p>a<br>b<img src="x"/></p><h1 class="t">Title</h1>', /^<h1\b/i)).toEqual(['Title']);
  });
  it('skips an element that is never closed', () => {
    expect(elementsInnerHtml('<div class="a">open', /class="a"/)).toEqual([]);
  });
});

describe('foldDiacritics / truncateForCell', () => {
  it('removes diacritics', () => {
    expect(foldDiacritics('Práce na plný úvazek')).toBe('Prace na plny uvazek');
  });
  it('truncates with an ellipsis and keeps the total within the limit', () => {
    expect(truncateForCell('x'.repeat(10), 5)).toBe('xxxx…');
    expect(truncateForCell('short', 5)).toBe('short');
    expect(truncateForCell('x'.repeat(CELL_LIMIT + 10)).length).toBe(CELL_LIMIT);
  });
});

describe('detectLanguage', () => {
  it('recognises Czech by diacritics and English by common words', () => {
    expect(detectLanguage('Hledáme zkušeného vývojáře pro mobilní aplikaci a naším cílem je kvalitní produkt.')).toBe('cs');
    expect(detectLanguage('We are looking for an engineer to build services for our team and you will work with us.')).toBe('en');
  });
  it('returns empty for short or unclear text', () => {
    expect(detectLanguage('Developer')).toBe('');
    expect(detectLanguage('Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor')).toBe('');
  });
});
