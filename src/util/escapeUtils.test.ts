import { escapeBody } from './escapeUtils';

describe('escapeBody', () => {
  describe('input validation', () => {
    test('throws error for null input', () => {
      expect(() => escapeBody(null as unknown as string)).toThrow('Input cannot be null or undefined');
    });

    test('throws error for undefined input', () => {
      expect(() => escapeBody(undefined as unknown as string)).toThrow('Input cannot be null or undefined');
    });
  });

  describe('disabled mode', () => {
    test('returns input unchanged', () => {
      const input = 'Test <% with %> special `characters` --- {{template}}';
      expect(escapeBody(input, 'disabled')).toBe(input);
    });
  });

  describe('normal mode', () => {
    test('replaces <% with \'<<\'', () => {
      expect(escapeBody('Test <% content', 'normal')).toBe('Test \'<<\' content');
    });

    test('replaces %> with \'>>\'', () => {
      expect(escapeBody('Test %> content', 'normal')).toBe('Test \'>>\' content');
    });

    test('replaces backticks with double quotes', () => {
      expect(escapeBody('Test `content`', 'normal')).toBe('Test "content"');
    });

    test('replaces triple dashes with separated dashes', () => {
      expect(escapeBody('Test --- content', 'normal')).toBe('Test - - - content');
    });

    test('replaces {{ with ((', () => {
      expect(escapeBody('Test {{ content', 'normal')).toBe('Test (( content');
    });

    test('replaces }} with ))', () => {
      expect(escapeBody('Test }} content', 'normal')).toBe('Test )) content');
    });

    test('handles multiple replacements', () => {
      const input = 'Test <% with %> special `characters` --- {{template}}';
      const expected = 'Test \'<<\' with \'>>\' special "characters" - - - ((template))';
      expect(escapeBody(input, 'normal')).toBe(expected);
    });

    test('applies normal mode when no mode is specified', () => {
      const input = 'Test <% with %> special `characters` --- {{template}}';
      const expected = 'Test \'<<\' with \'>>\' special "characters" - - - ((template))';
      expect(escapeBody(input)).toBe(expected);
    });
  });

  describe('strict mode', () => {
    test('removes characters that are not alphanumeric, whitespace, or allowed punctuation', () => {
      const input = 'Test @#$^&<>| allowed: .,()[]{}/\\*+-:"\'';
      const expected = 'Test #^&>| allowed: .,()[]/*+-:"\'';
      expect(escapeBody(input, 'strict')).toBe(expected);
    });

    test('keeps alphanumeric characters and whitespace', () => {
      expect(escapeBody('Test 123 with spaces', 'strict')).toBe('Test 123 with spaces');
    });
  });

  describe('veryStrict mode', () => {
    test('removes characters that are not alphanumeric, whitespace, or commas/periods', () => {
      const input = 'Test @#$^&<>| allowed: 123, abc.';
      const expected = 'Test  allowed 123, abc.';
      expect(escapeBody(input, 'veryStrict')).toBe(expected);
    });

    test('keeps alphanumeric characters, whitespace, commas, and periods', () => {
      expect(escapeBody('Test 123, with spaces. And punctuation', 'veryStrict'))
        .toBe('Test 123, with spaces. And punctuation');
    });
  });
}); 