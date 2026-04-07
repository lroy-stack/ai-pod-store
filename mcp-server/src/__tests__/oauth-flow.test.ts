import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockRedisClient } from './test-utils.js';

// Mock Redis
const mockRedis = createMockRedisClient();
vi.mock('../lib/redis.js', () => ({
  getRedisClient: () => mockRedis,
}));

// Import OAuth functions after mocking
import {
  handleAuthorizationServerMetadata,
  handleProtectedResourceMetadata,
} from '../auth/oauth-provider.js';

describe('OAuth 2.1 Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization Server Metadata', () => {
    it('should expose authorization endpoint', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.authorization_endpoint).toBeDefined();
      expect(body.authorization_endpoint).toContain('/authorize');
    });

    it('should expose token endpoint', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.token_endpoint).toBeDefined();
      expect(body.token_endpoint).toContain('/token');
    });

    it('should expose revocation endpoint', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.revocation_endpoint).toBeDefined();
      expect(body.revocation_endpoint).toContain('/revoke');
    });

    it('should list supported response types', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.response_types_supported).toContain('code');
    });

    it('should list supported grant types', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.grant_types_supported).toContain('authorization_code');
    });

    it('should support S256 code challenge method', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.code_challenge_methods_supported).toContain('S256');
    });

    it('should not require client authentication', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.token_endpoint_auth_methods_supported).toContain('none');
    });

    it('should have correct issuer', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.issuer).toBeDefined();
    });
  });

  describe('Protected Resource Metadata', () => {
    it('should expose resource identifier', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleProtectedResourceMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.resource).toBeDefined();
    });

    it('should list authorization servers', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleProtectedResourceMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.authorization_servers).toBeDefined();
      expect(Array.isArray(body.authorization_servers)).toBe(true);
    });

    it('should list supported scopes', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleProtectedResourceMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.scopes_supported).toContain('read');
      expect(body.scopes_supported).toContain('write');
    });

    it('should return 200 status', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleProtectedResourceMetadata(req as any, res as any);

      expect(res.getStatusCode()).toBe(200);
    });

    it('should return JSON content-type', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleProtectedResourceMetadata(req as any, res as any);

      const headers = res.getHeaders();
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('PKCE Support', () => {
    it('should require code challenge for authorization_code grant', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());

      // Verify PKCE is required via code_challenge_methods_supported
      expect(body.code_challenge_methods_supported).toBeDefined();
      expect(body.code_challenge_methods_supported.length).toBeGreaterThan(0);
    });

    it('should only support S256 method (not plain)', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());

      expect(body.code_challenge_methods_supported).toContain('S256');
      expect(body.code_challenge_methods_supported).not.toContain('plain');
    });
  });

  describe('Security Headers', () => {
    it('should return proper content-type for metadata endpoint', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const headers = res.getHeaders();
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should return 200 for valid metadata request', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      expect(res.getStatusCode()).toBe(200);
    });
  });

  describe('OAuth 2.1 Compliance', () => {
    it('should not support implicit grant', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());

      // OAuth 2.1 removes implicit grant
      expect(body.response_types_supported).not.toContain('token');
      expect(body.grant_types_supported).not.toContain('implicit');
    });

    it('should not support resource owner password credentials', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());

      // OAuth 2.1 removes password grant
      expect(body.grant_types_supported).not.toContain('password');
    });

    it('should support authorization code grant with PKCE', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());

      expect(body.grant_types_supported).toContain('authorization_code');
      expect(body.code_challenge_methods_supported).toContain('S256');
    });
  });
});
