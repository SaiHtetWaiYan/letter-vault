const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
  'blockquote', 'h1', 'h2', 'h3', 'h4', 'a', 'span', 'div',
]);

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel']);
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'text/plain',
]);

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeHtml(value = '') {
  let html = String(value);
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|meta|link)[^>]*\/?\s*>/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  return html.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, tagName, rawAttrs) => {
    const tag = tagName.toLowerCase();
    const closing = match.startsWith('</');
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (closing) return `</${tag}>`;

    const attrs = [];
    rawAttrs.replace(/([a-zA-Z0-9:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g, (_m, name, _raw, doubleValue, singleValue, bareValue) => {
      const attr = name.toLowerCase();
      const value = doubleValue ?? singleValue ?? bareValue ?? '';
      if (!ALLOWED_ATTRS.has(attr)) return '';
      if (attr === 'href' && /^\s*(javascript:|data:|vbscript:)/i.test(value)) return '';
      attrs.push(`${attr}="${escapeHtml(value)}"`);
      return '';
    });

    if (tag === 'a') {
      if (!attrs.some((attr) => attr.startsWith('rel='))) attrs.push('rel="noopener noreferrer"');
      if (!attrs.some((attr) => attr.startsWith('target='))) attrs.push('target="_blank"');
    }

    return `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
  });
}

export function sanitizeAttachments(files = []) {
  if (!Array.isArray(files)) return [];
  return files
    .filter((file) => {
      const type = String(file?.type || '').toLowerCase();
      const size = Number(file?.size || 0);
      return (
        ALLOWED_ATTACHMENT_TYPES.has(type) &&
        size > 0 &&
        size <= 10 * 1024 * 1024 &&
        typeof file?.data === 'string' &&
        file.data.startsWith(`data:${type};base64,`)
      );
    })
    .map((file) => ({
      name: String(file.name || 'attachment').replace(/[^\w.\- ]/g, '').slice(0, 120) || 'attachment',
      type: String(file.type).toLowerCase(),
      size: Number(file.size),
      data: file.data,
    }));
}
