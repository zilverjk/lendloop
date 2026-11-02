// Credential type holding one HMAC secret (and, for the n8n -> Convex direction, the Convex site URL).
// Created at container start by entrypoint.sh from env vars; encrypted at rest with N8N_ENCRYPTION_KEY.
class LendLoopHmacApi {
  constructor() {
    this.name = 'lendLoopHmacApi';
    this.displayName = 'LendLoop HMAC API';
    this.properties = [
      { displayName: 'Secret', name: 'secret', type: 'string', typeOptions: { password: true }, default: '' },
      { displayName: 'Base URL', name: 'baseUrl', type: 'string', default: '', description: 'Convex HTTP actions URL (only needed for Sign / Signed Request)' },
    ];
  }
}
module.exports = { LendLoopHmacApi };
