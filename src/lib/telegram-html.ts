import DOMPurify from 'dompurify';

export const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'a', 'code', 'pre'];

/**
 * Validates if the given HTML string contains only allowed Telegram tags.
 * @param html The HTML string to validate.
 * @returns True if the HTML is valid, otherwise an error message.
 */
export function validateTelegramHtml(html: string): boolean | string {
  if (typeof window === 'undefined') {
    return true; // Cannot validate on SSR, trust the client
  }
  
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
    RETURN_DOM_FRAGMENT: true,
  });

  const tempDiv = document.createElement('div');
  tempDiv.appendChild(clean);
  const sanitizedHtml = tempDiv.innerHTML;
  
  const originalTags = html.replace(/<br\s*\/?>/g, '').match(/<[/]?[a-zA-Z0-9]+[^>]*>/g) || [];
  const sanitizedTags = sanitizedHtml.match(/<[/]?[a-zA-Z0-9]+[^>]*>/g) || [];
  
  if (originalTags.length !== sanitizedTags.length) {
      return 'The message contains unsupported HTML tags or attributes. Allowed tags: <b>, <i>, <a>, <code>, <pre>. Links must have an href attribute.';
  }

  // Check for unclosed tags, which can be a problem
  const openTags = html.match(/<([a-zA-Z]+)(?![^>]*\/>)[^>]*>/g)?.filter(tag => ALLOWED_TAGS.includes(tag.slice(1, -1))) || [];
  const closeTags = html.match(/<\/[a-zA-Z]+>/g) || [];
  if(openTags.length !== closeTags.length) {
    return 'The message seems to contain unclosed HTML tags.';
  }


  return true;
}

/**
 * Sanitizes and formats HTML for preview.
 * Replaces newlines with <br> for proper display.
 * @param html The raw HTML from the editor.
 * @returns A sanitized HTML string for preview.
 */
export function sanitizeAndFormatHtml(html: string): string {
    if (typeof window === 'undefined') {
        return '';
    }
     // First, sanitize the HTML to remove any unwanted tags/attributes
    const clean = DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR: ['href']
    });

    // Then, replace newlines with <br> for display purposes
    return clean.replace(/\n/g, '<br />');
} 