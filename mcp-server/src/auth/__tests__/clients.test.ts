import { describe, it, expect, beforeEach } from 'vitest';
import { getClient, validateRedirectUri, listClientIds, _resetClients } from '../clients.js';

beforeEach(() => {
  _resetClients();
  delete process.env.MCP_REGISTERED_CLIENTS;
});

describe('getClient', () => {
  it('returns config for known clients', () => {
    expect(getClient('claude-desktop')).toBeDefined();
    expect(getClient('claude-desktop')!.name).toBe('Claude Desktop');
    expect(getClient('chatgpt')!.name).toBe('ChatGPT');
    expect(getClient('store-web')!.name).toBe('Store Web');
  });

  it('returns undefined for unknown clients', () => {
    expect(getClient('unknown-client')).toBeUndefined();
    expect(getClient('')).toBeUndefined();
  });

  it('loads extra clients from MCP_REGISTERED_CLIENTS env var', () => {
    process.env.MCP_REGISTERED_CLIENTS = JSON.stringify({
      'custom-app': {
        name: 'Custom App',
        redirect_uris: ['https://custom.app/callback'],
        scopes: ['read'],
        type: 'public',
      },
    });
    _resetClients();

    const client = getClient('custom-app');
    expect(client).toBeDefined();
    expect(client!.name).toBe('Custom App');
    expect(client!.scopes).toEqual(['read']);
  });

  it('ignores invalid env var JSON', () => {
    process.env.MCP_REGISTERED_CLIENTS = 'not-json';
    _resetClients();

    // Should still load builtins
    expect(getClient('claude-desktop')).toBeDefined();
  });
});

describe('listClientIds', () => {
  it('returns all builtin client IDs', () => {
    const ids = listClientIds();
    expect(ids).toContain('claude-desktop');
    expect(ids).toContain('chatgpt');
    expect(ids).toContain('store-web');
    expect(ids).toContain('claude-ai');
  });
});

describe('validateRedirectUri', () => {
  describe('localhost wildcard ports', () => {
    it('accepts any port on localhost for claude-desktop', () => {
      expect(validateRedirectUri('claude-desktop', 'http://localhost:12345/callback')).toBe(true);
      expect(validateRedirectUri('claude-desktop', 'http://localhost:3000/')).toBe(true);
      expect(validateRedirectUri('claude-desktop', 'http://localhost:8080/some/path')).toBe(true);
    });

    it('rejects localhost without port', () => {
      expect(validateRedirectUri('claude-desktop', 'http://localhost/callback')).toBe(false);
    });

    it('rejects https on localhost', () => {
      expect(validateRedirectUri('claude-desktop', 'https://localhost:3000/callback')).toBe(false);
    });

    it('rejects non-localhost hosts', () => {
      expect(validateRedirectUri('claude-desktop', 'http://evil.com:3000/callback')).toBe(false);
    });
  });

  describe('path wildcards', () => {
    it('accepts matching path prefix for chatgpt', () => {
      expect(validateRedirectUri('chatgpt', 'https://chatgpt.com/aip/plugin-123/oauth/callback')).toBe(true);
      expect(validateRedirectUri('chatgpt', 'https://chatgpt.com/aip/abc/oauth/callback')).toBe(true);
    });

    it('rejects non-matching domain', () => {
      expect(validateRedirectUri('chatgpt', 'https://evil.com/aip/plugin-123/oauth/callback')).toBe(false);
    });

    it('rejects non-matching path prefix', () => {
      expect(validateRedirectUri('chatgpt', 'https://chatgpt.com/evil/path')).toBe(false);
    });
  });

  describe('exact match', () => {
    it('accepts exact URI for claude-ai', () => {
      expect(validateRedirectUri('claude-ai', 'https://claude.ai/oauth/callback')).toBe(true);
    });

    it('rejects URI with extra path', () => {
      expect(validateRedirectUri('claude-ai', 'https://claude.ai/oauth/callback/extra')).toBe(false);
    });
  });

  describe('unknown clients', () => {
    it('rejects any URI for unknown client_id', () => {
      expect(validateRedirectUri('unknown', 'http://localhost:3000/callback')).toBe(false);
      expect(validateRedirectUri('unknown', 'https://example.com/callback')).toBe(false);
    });
  });

  describe('invalid URIs', () => {
    it('rejects invalid URI strings', () => {
      expect(validateRedirectUri('claude-desktop', 'not-a-url')).toBe(false);
      expect(validateRedirectUri('claude-desktop', '')).toBe(false);
    });
  });

  describe('store-web locale paths', () => {
    it('accepts locale paths on production', () => {
      expect(validateRedirectUri('store-web', 'https://yourdomain.com/en/auth/mcp-callback')).toBe(true);
      expect(validateRedirectUri('store-web', 'https://yourdomain.com/es/auth/mcp-callback')).toBe(true);
      expect(validateRedirectUri('store-web', 'https://yourdomain.com/de/auth/mcp-callback')).toBe(true);
    });

    it('accepts locale paths on localhost dev', () => {
      expect(validateRedirectUri('store-web', 'http://localhost:3000/en/auth/mcp-callback')).toBe(true);
    });

    it('rejects different domain', () => {
      expect(validateRedirectUri('store-web', 'https://evil.com/en/auth/mcp-callback')).toBe(false);
    });
  });
});
