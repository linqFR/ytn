
/**
 * Simple Tag-based Template Rendering.
 */

export interface TemplateTag {
  tag: string;
  txt: string;
  onlyonce?: boolean;
}

/**
 * Replaces tags in a text using a map of tag definitions.
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
