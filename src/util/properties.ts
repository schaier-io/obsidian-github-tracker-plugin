export function extractProperties(content: string): Record<string, string> {
  const properties: Record<string, string> = {};
  
  // Check if content has frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return properties;

  const frontmatter = match[1];
  const lines = frontmatter.split('\n');

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (!key || !valueParts.length) continue;
    
    const value = valueParts.join(':').trim();
    if (value) {
      properties[key.trim()] = value;
    }
  }

  return properties;
}

export function mapToProperties(content: Record<string, string>): string {
  
  const propertiesString = Object.entries(content)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return `---
${propertiesString}
---
`;
}
