import { chromium } from "playwright";
import fs from "node:fs";
const S = { access_token: "qa.viewonly", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, refresh_token: "r",
  user: { id: "qa", aud: "authenticated", role: "authenticated", email: "qa@veterinaria.pe", identities: null, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
const patchCode = fs.readFileSync("/tmp/qz-orig-code.js").toString() + `
window.__qz_fake_session = window.__qz_fake_session || null;
const _qzGS = GoTrueClient.prototype.getSession;
GoTrueClient.prototype.getSession = function () {
  const p = _qzGS.apply(this, arguments);
  if (window.__qz_fake_session) { return p.then(() => ({ data: { session: window.__qz_fake_session }, error: null })); }
  return p;
};
`;
const ctx = await (new chromium().launch()).launch ? null : null;
