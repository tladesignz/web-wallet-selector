import {
    type InferInput,
    array,
    object,
    optional,
    picklist,
    pipe,
    record,
    string,
    nonEmpty,
    unknown,
} from 'valibot';

/**
 * OpenID4VP Response Type
 *
 * @see https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-5.6
 */
export type OpenID4VPResponseType = InferInput<typeof OpenID4VPResponseTypeSchema>;
export const OpenID4VPResponseTypeSchema = picklist(['vp_token', 'vp_token id_token', 'code']);

/**
 * OpenID4VP Response Mode
 *
 * @see https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-8.2
 */
export type OpenID4VPResponseMode = InferInput<typeof OpenID4VPResponseModeSchema>;
export const OpenID4VPResponseModeSchema = picklist([
    'direct_post',
    'dc_api',
    'direct_post.jwt',
    'dc_api.jwt',
]);

/**
 * OpenID4VP Client Metadata
 *
 * @see https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-5.1
 */
export type OpenID4VPClientMetadata = InferInput<typeof OpenID4VPClientMetadataSchema>;
export const OpenID4VPClientMetadataSchema = object({
    jwks: optional(object({
        keys: pipe(array(record(string(), unknown())), nonEmpty()),
    })),
    encrypted_response_enc_values_supported: optional(pipe(array(string()), nonEmpty())),
    vp_formats_supported: optional(record(string(), unknown())),
});
