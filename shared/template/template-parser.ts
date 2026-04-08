/**
 * Simple Tag-based Template Rendering.
 */

/**
 * @type {Object} TemplateTag
 * @description Contract for a template replacement tag.
 *
 * @property {string} tag - The literal string or pattern to search for in the template.
 * @property {string} txt - The replacement text.
 * @property {boolean} [onlyonce=false] - If true, only the first occurrence of the tag is replaced.
 */
export interface TemplateTag {
  tag: string;
  txt: string;
  onlyonce?: boolean;
}

/**
 * @function renderTemplate
 * @description Standardized engine that replaces multiple tags in a text using a list of tag definitions.
 *
 * @param {string} text - The raw template string containing tags.
 * @param {TemplateTag[]} tagmap - An array of tag replacement instructions.
 * @returns {string} The rendered string with all replacements performed.
 */
export const renderTemplate = (text: string, tagmap: TemplateTag[]): string => {
  let result = text;
  for (const { tag, txt, onlyonce = false } of tagmap) {
    if (onlyonce) {
      result = result.replace(tag, txt);
    } else {
      result = result.replaceAll(tag, txt);
    }
  }
  return result;
};
