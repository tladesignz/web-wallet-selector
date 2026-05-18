# Wallet Invocation Flow

This document describes how the extension invokes wallets to fulfill Digital Credentials API requests.

## Overview

When a user selects a wallet from the wallet selector modal, the extension invokes the wallet by opening it in a new window with the authorization request parameters.

## Flow Diagram

```
1. Website calls navigator.credentials.get()
2. Extension intercepts the call (inject.js)
3. Extension shows wallet selector modal (modal.js)
4. User selects a wallet
5. Extension builds wallet authorization URL (inject.js: buildWalletUrl)
6. Extension opens wallet in new window
7. Wallet authenticates user and processes request
8. Wallet sends response via postMessage
9. Extension validates response (OpenID4VPPlugin)
10. Extension returns credential to website
```

## Wallet URL Construction

### OpenID4VP Protocol

For `openid4vp` protocol variants, the extension constructs an authorization request URL following the OpenID4VP specification:

**Endpoint**: `<wallet_url>/cb` (or custom path if specified in wallet config)

**Parameters**:
- `request_id`: Unique identifier for this request (UUID, for response correlation)
- `client_id`: Origin of the requesting website
- `response_type`: `vp_token` (requesting a verifiable presentation)
- `response_mode`: `direct_post` (wallet should POST response)
- `nonce`: Cryptographic nonce for replay protection
- `client_metadata`: Verifier capabilities (vp_formats_supported, etc.)
- `presentation_definition`: Credential requirements (mapped from DC QL query)
- `response_uri`: Where wallet should send the response
- `_protocol`: Protocol variant identifier (for debugging)

**Example URL**:
```
https://demo.wwwallet.org/cb?
  request_id=550e8400-e29b-41d4-a716-446655440000&
  client_id=https://demo.digitalcredentials.dev&
  response_type=vp_token&
  response_mode=direct_post&
  nonce=abc123&
  client_metadata={"vp_formats_supported":...}&
  presentation_definition={"credentials":[...]}&
  response_uri=https://demo.digitalcredentials.dev/&
  _protocol=openid4vp-v1-unsigned
```

### Response Handling

The extension listens for wallet responses via two mechanisms:

#### 1. postMessage API

The wallet can send the response via `window.postMessage()`:

```javascript
window.opener.postMessage({
  type: 'WC_WALLET_RESPONSE',
  requestId: '<request-id>',  // Must match request_id from URL
  response: {
    vp_token: '<verifiable-presentation>',
    presentation_submission: {
      id: '<submission-id>',
      definition_id: '<definition-id>',
      descriptor_map: [...]
    }
  }
}, verifierOrigin);
```

**Requirements**:
- Message origin must match wallet's registered domain
- `type` must be `'WC_WALLET_RESPONSE'`
- `requestId` must match the `request_id` from the authorization URL
- `response` must include required OpenID4VP response fields

#### 2. HTTP Redirect/POST (Future)

For production wallets, the standard OpenID4VP flow uses HTTP redirects or POST:

1. Wallet redirects to `response_uri` with response parameters
2. Verifier backend receives and validates the response
3. Verifier frontend is notified of completion

This is not yet implemented in the extension but can be added for production deployments.

## Timeout Handling

The extension sets a 5-minute timeout for wallet responses. If no response is received within this time:

1. Event listener is removed
2. Request is rejected with timeout error
3. User sees an error message

## Popup Blocking

Modern browsers may block popups opened by extensions. The extension handles this by:

1. Attempting to open wallet in popup window
2. If blocked, prompting user to allow popup
3. Falling back to opening in new tab if user consents

## Wallet Requirements

For a wallet to work with this extension, it must:

1. **Endpoint**: Expose an OpenID4VP authorization endpoint (e.g., `/cb`, `/authorize`)

2. **Request Handling**: Accept authorization requests via URL parameters:
   - Parse `client_metadata`, `presentation_definition`, `nonce`, etc.
   - Support DC QL query format (or map from presentation definition)

3. **Response Format**: Return responses in OpenID4VP format:
   ```json
   {
     "vp_token": "<jwt-or-json-vp>",
     "presentation_submission": {
       "id": "<submission-id>",
       "definition_id": "<definition-id>",
       "descriptor_map": [
         {
           "id": "<descriptor-id>",
           "format": "mso_mdoc",
           "path": "$"
         }
       ]
     }
   }
   ```

4. **Response Delivery**: Send response via one of:
   - `window.opener.postMessage()` (for same-origin or CORS-enabled)
   - HTTP POST to `response_uri` (standard OpenID4VP)
   - HTTP redirect to `response_uri` (with response in URL/fragment)

5. **Origin Validation**: Verify the requesting origin is trusted before releasing credentials

## Configuration

Wallets are configured in the extension options with:

- **Name**: Display name for the wallet
- **URL**: Base URL of the wallet (e.g., `https://demo.wwwallet.org/`)
- **Protocols**: List of supported protocol identifiers (e.g., `["openid4vp-v1-unsigned"]`)
- **Icon**: Emoji or icon character
- **Color**: Brand color for UI
- **Description**: Short description

The extension automatically appends the appropriate endpoint path (`/cb`) when constructing authorization URLs.

## Security Considerations

1. **Origin Verification**: Extension verifies postMessage origin matches wallet domain
2. **Request Validation**: Protocol plugins validate request structure before sending to wallet
3. **Response Validation**: Protocol plugins validate response structure and signatures
4. **Nonce Protection**: Each request includes a unique nonce to prevent replay attacks
5. **HTTPS Required**: All wallet URLs must use HTTPS in production

## Testing

To test wallet invocation:

1. Configure a test wallet in extension options
2. Navigate to a test verifier (e.g., https://demo.digitalcredentials.dev/)
3. Request credentials
4. Select the test wallet from the modal
5. Wallet window should open with authorization request
6. Check browser console for logs of URL construction and response handling

## Known Limitations

1. **Popup Blocking**: Some browsers aggressively block popups from extensions
2. **Signed Requests**: JAR (JWT-secured authorization requests) not yet implemented
3. **Response Encryption**: Encrypted responses not yet supported
4. **Batch Credentials**: Only single credential requests tested
5. **Cross-Origin Messaging**: May require CORS configuration on wallet

## Future Enhancements

- Support for JAR (signed authorization requests)
- Response encryption (JWE)
- Batch credential requests
- Better popup fallback handling
- Deep linking support for mobile wallets
- QR code display for cross-device flows
