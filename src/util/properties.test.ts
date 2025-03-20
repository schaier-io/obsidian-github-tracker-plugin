import { describe, it, expect } from '@jest/globals';
import { extractProperties } from './properties';

describe('propertiesExtractor', () => {
  it('should extract properties from frontmatter', () => {
    const content = `---
title: Test Issue😂
assignee😂: john-doe
labels: [bug, enhancement]
---

Content here`;

    const properties = extractProperties(content);
    expect(properties).toEqual({
      title: 'Test Issue😂',
      "assignee😂": 'john-doe',
      labels: '[bug, enhancement]'
    });
  });

  it('should handle empty frontmatter', () => {
    const content = `---
---

Content here`;

    const properties = extractProperties(content);
    expect(properties).toEqual({});
  });

  it('should handle content without frontmatter', () => {
    const content = 'Content here';
    const properties = extractProperties(content);
    expect(properties).toEqual({});
  });

  it('should handle malformed frontmatter', () => {
    const content = `---
title: Test Issue
---

Content here`;

    const properties = extractProperties(content);
    expect(properties).toEqual({
      title: 'Test Issue'
    });
  });
}); 