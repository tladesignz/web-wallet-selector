# OpenID4VP Protocol Implementation

## Overview

This document describes the OpenID for Verifiable Presentations (OpenID4VP) protocol implementation for the Wallet Companion browser extension, based on the [wwWallet](https://github.com/wwWallet) reference implementation.

## Protocol Specification

- **Protocol ID**: `openid4vp`
- **Specification**: [OpenID4VP 1.0](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- **Related Specs**: 
  - [DCQL (Digital Credentials Query Language)](https://wicg.github.io/digital-credentials/)

## Architecture

### Request Flow

```
Verifier Website                Browser Extension              Web Wallet
      |                                |                             |
      | 1. navigator.credentials.get() |                             |
      |------------------------------->|                             |
      |                                |                             |
      | 2. Intercept & Parse           |                             |
      |                                |                             |
      | 3. Validate OpenID4VP Request  |                             |
      |                                |                             |
      | 4. Show Wallet Selector        |                             |
      |<-------------------------------|                             |
      |                                |                             |
      | 5. User selects wallet         |                             |
      |------------------------------->|                             |
      |                                | 6. Forward Request          |
      |                                |---------------------------->|
      |                                |                             |
      |                                | 7. User Consent & Response  |
      |                                |<----------------------------|
      |                                |                             |
      | 8. Return VP Token             |                             |
      |<-------------------------------|                             |
```

### Key Components

1. **OpenID4VP Handler** (`src/content/dc-api/handlers/openid4vp.ts`)
   - Parses authorization requests
   - Validates request parameters
   - Formats requests for wallets
   - Builds wallet invocation URLs

2. **Request Formats Supported**
   - Direct parameters in URL
   - JWT Secured Authorization Request (JAR) via `request_uri`
   - Presentation Definition (DIF PE 2.0)
   - DCQL Query

3. **Response Formats Supported**
   - VP Token (JWT format)
   - Encrypted Response (JWE for `direct_post.jwt`)
   - Presentation Submission

## Implementation Details

### Request Parsing

The plugin handles two primary request formats:

#### 1. URL with Direct Parameters

```javascript
openid4vp://?client_id=x509_san_dns:verifier.example.com
  &request_uri=https://verifier.example.com/request/abc123
  &response_uri=https://verifier.example.com/callback
  &nonce=abc123
```

**Supported Parameters:**
- `client_id` (required): Verifier identifier
- `request_uri`: URL to fetch JWT Authorization Request
- `response_uri`: Callback URL for the response
- `nonce` (required): Prevents replay attacks
- `state`: Maintains state between request and callback
- `client_metadata`: Verifier metadata (JSON)
- `response_mode`: `direct_post` or `direct_post.jwt`
- `dcql_query`: DCQL query for credential selection (JSON)

#### 2. JWT Secured Authorization Request (JAR)

When `request_uri` is provided:

1. Fetch JWT from the URL
2. Validate JWT header type: `oauth-authz-req+jwt`
3. Verify signature using x5c certificate (TODO: implement)
4. Extract authorization parameters from JWT payload
5. Validate hostname consistency

**JWT Structure:**
```json
{
  "header": {
    "typ": "oauth-authz-req+jwt",
    "alg": "ES256",
    "x5c": ["MIICertificate..."]
  },
  "payload": {
    "client_id": "x509_san_dns:verifier.example.com",
    "response_uri": "https://verifier.example.com/callback",
    "nonce": "abc123",
    "dcql_query": {...}
  }
}
```

### Client ID Schemes

The plugin validates `client_id` schemes:

1. **`x509_san_dns:hostname`** (Recommended by wwWallet)
   - Verifier identified by DNS name in x.509 certificate
   - Enables certificate-based trust

2. **`https://hostname`**
   - HTTP URL as verifier identifier
   - Common in development

3. **Other schemes** (e.g., `did:web:...`)
   - Logged as warnings
   - May not be fully supported

### DCQL (Digital Credentials Query Language) for credential selection:

```json
{
  "credentials": [
    {
      "id": "employee-credential",
      "format": "vc+sd-jwt",
      "meta": {
        "vct_values": ["https://example.com/credentials/employee"]
      },
      "claims": [
        {"path": ["name"]},
        {"path": ["email"]},
        {"path": ["department"]}
      ]
    }
  ],
  "credential_sets": [
    {
      "purpose": "Verify employment status"
    }
  ]
}
```

### Response Validation

#### Standard Response (direct_post)

```javascript
{
  "vp_token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
  "state": "original-state-value"
}
```

#### Encrypted Response (direct_post.jwt)

```javascript
{
  "response": "eyJhbGciOiJFQ0RILUVTIiwiZW5jIjoiQTI1NkdDTSJ9..." // JWE
}
```

**JWE Payload (after decryption):**
```json
{
  "vp_token": "eyJhbGciOiJFUzI1NiJ9...",
  "state": "..."
}
```

### VP Token Validation

The plugin validates that VP tokens:

1. Are valid JWT or JSON-LD format
2. Contain the requested credential claims
3. Are properly signed

## wwWallet Integration Insights

### Key Learnings from wwWallet Source

1. **Certificate Validation** (`src/lib/services/OpenID4VP/OpenID4VP.ts:485-516`)
   - wwWallet verifies hostname matches between `request_uri` and `response_uri`
   - Validates x.509 certificate SAN (Subject Alternative Names)
   - Optional SSL certificate pinning for enhanced security

2. **Credential Matching** (`src/lib/services/OpenID4VP/OpenID4VP.ts:229-393`)
   - DCQL with credential format and claims matching
   - Supports multiple credential formats:
     - SD-JWT (Selective Disclosure JWT)
     - mDoc (ISO 18013-5 Mobile Documents)
     - W3C Verifiable Credentials

3. **Response Modes** (`src/lib/services/OpenID4VP/OpenID4VP.ts:717-788`)
   - `direct_post`: Plain response with form-encoded VP token
   - `direct_post.jwt`: Encrypted JWE response with ephemeral keys (ECDH-ES)

4. **State Management** (`src/lib/types/OpenID4VPRelyingPartyState.ts`)
   - Stores request state to prevent replay attacks
   - Uses `nonce` for request-response correlation
   - Validates `nonce` hasn't been used before

## Security Considerations

### Implemented

✅ **Request Validation**
- Client ID format validation
- Required parameter checks
- Response mode validation

✅ **Response Validation**
- VP token presence check
- Presentation submission structure validation
- Descriptor map completeness

### TODO: Enhanced Security

⚠️ **JWT Signature Verification**
- Verify JAR signatures using x5c certificates
- Validate certificate chain
- Check certificate expiration

⚠️ **Certificate Validation**
- Verify SAN matches verifier hostname
- Implement optional SSL certificate pinning
- Validate certificate revocation status

⚠️ **Nonce Management**
- Track used nonces to prevent replay
- Implement nonce expiration
- Validate nonce in response matches request

⚠️ **Response Encryption**
- Decrypt JWE responses for `direct_post.jwt`
- Validate encryption algorithms
- Secure key management

## Usage Example

### Basic OpenID4VP Request

```javascript
// Verifier initiates request
const credential = await navigator.credentials.get({
  digital: {
    providers: [{
      protocol: 'openid4vp',
      request: {
        client_id: 'https://verifier.example.com',
        response_uri: 'https://verifier.example.com/callback',
        nonce: 'random-nonce-123',
        dcql_query: {
          credentials: [{
            id: 'org.example.identity',
            format: 'vc+sd-jwt',
            claims: [
              { path: ['given_name'] },
              { path: ['family_name'] }
            ]
          }]
        }
      }
    }]
  }
});

// Extension intercepts, validates, and forwards to wallet
// Wallet returns VP token
// Extension validates response and returns to verifier
```

### Using JWT Authorization Request

```javascript
const credential = await navigator.credentials.get({
  digital: {
    providers: [{
      protocol: 'openid4vp',
      request: {
        client_id: 'x509_san_dns:verifier.example.com',
        request_uri: 'https://verifier.example.com/requests/abc123'
      }
    }]
  }
});
```

## Testing

The implementation includes comprehensive tests covering:

- ✅ Request parsing (URL and direct parameters)
- ✅ Parameter validation
- ✅ Client ID scheme validation
- ✅ Response mode validation
- ✅ Wallet URL building
- ✅ DCQL query handling

Run tests:
```bash
pnpm test tests/unit/content/dc-api/handlers/openid4vp.test.ts
```

## References

### Specifications
- [OpenID4VP 1.0](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- [DCQL Draft](https://wicg.github.io/digital-credentials/)
- [RFC 9101 - JAR (JWT Secured Authorization Request)](https://www.rfc-editor.org/rfc/rfc9101.html)

### wwWallet Source Files
- `wallet-frontend/src/lib/services/OpenID4VP/OpenID4VP.ts` - Main implementation
- `wallet-frontend/src/hocs/UriHandlerProvider.tsx` - URI routing
- `wallet-frontend/src/lib/types/OpenID4VPRelyingPartyState.ts` - State management

### Related Documents
- [PROTOCOL_SUPPORT.md](./PROTOCOL_SUPPORT.md) - General protocol architecture
- [README.md](../../README.md) - Project overview

## Future Enhancements

1. **Complete JAR Support**
   - Implement JWT signature verification
   - Add x5c certificate validation
   - Support for certificate chains

2. **Enhanced Security**
   - Nonce replay prevention
   - Response encryption/decryption
   - Certificate pinning

3. **Additional Formats**
   - Support for more credential formats (mDoc, SD-JWT)
   - Format-specific validation rules

4. **Error Handling**
   - Detailed error codes for debugging
   - User-friendly error messages
   - Logging and telemetry

5. **Protocol Extensions**
   - Support for VP Token v2
   - Enhanced DCQL features
   - Custom presentation frame generation
