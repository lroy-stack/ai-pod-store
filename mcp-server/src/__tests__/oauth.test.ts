import { describe, it, expect } from 'vitest';
import {
  handleAuthorizationServerMetadata,
  handleProtectedResourceMetadata,
} from '../auth/oauth-provider.js';
import { createMockRequest, createMockResponse } from './test-utils.js';

describe('OAuth Provider', () => {
  const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8002';

  describe('Authorization Server Metadata', () => {
    it('should return correct OAuth 2.1 metadata', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json',
      });

      const body = JSON.parse(res.getBody());

      expect(body).toMatchObject({
        issuer: MCP_BASE_URL,
        authorization_endpoint: `${MCP_BASE_URL}/authorize`,
        token_endpoint: `${MCP_BASE_URL}/token`,
        revocation_endpoint: `${MCP_BASE_URL}/revoke`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      });
    });
  });

  describe('Protected Resource Metadata', () => {
    it('should return correct resource metadata', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleProtectedResourceMetadata(req as any, res as any);

      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json',
      });

      const body = JSON.parse(res.getBody());

      expect(body).toMatchObject({
        resource: MCP_BASE_URL,
        authorization_servers: [MCP_BASE_URL],
        scopes_supported: ['read', 'write'],
      });
    });
  });

  describe('OAuth Flow Integration', () => {
    it('should support PKCE with S256', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.code_challenge_methods_supported).toContain('S256');
    });

    it('should support authorization_code grant type', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.grant_types_supported).toContain('authorization_code');
    });

    it('should not require client authentication', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      handleAuthorizationServerMetadata(req as any, res as any);

      const body = JSON.parse(res.getBody());
      expect(body.token_endpoint_auth_methods_supported).toContain('none');
    });
  });
});
