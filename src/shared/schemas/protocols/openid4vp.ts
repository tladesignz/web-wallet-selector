import { type InferInput, picklist } from 'valibot';

export type OpenID4VPResponseType = InferInput<typeof OpenID4VPResponseTypeSchema>;
export const OpenID4VPResponseTypeSchema = picklist(['vp_token', 'vp_token id_token', 'code']);

export type OpenID4VPResponseMode = InferInput<typeof OpenID4VPResponseModeSchema>;
export const OpenID4VPResponseModeSchema = picklist([
	'direct_post',
	'dc_api',
	'direct_post.jwt',
	'dc_api.jwt',
]);
