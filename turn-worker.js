// ============================================================
// SUGAR WARS — Cloudflare Worker: TURN認証情報プロキシ
// ------------------------------------------------------------
// 目的：Cloudflare TURNの「APIトークン」をクライアント(ゲームHTML)に出さず、
//       Worker側の秘密として保持する。ゲームはこのWorkerにGETするだけで
//       短命のTURN認証情報(iceServers)を受け取れる。
//
// 設定（Cloudflareダッシュボード → Workers → このWorker → Settings → Variables）:
//   Secrets（暗号化・必須）:
//     TURN_KEY_ID   … Realtime → TURN Server のキーID
//     TURN_TOKEN    … そのキーのAPIトークン
//   Variables（任意）:
//     ALLOWED_ORIGINS … 許可するゲームのオリジン（カンマ区切り）。
//                       例: "https://negiramen1922.github.io,http://localhost:8000"
//                       空なら全許可（まず動作確認したいとき）。
//     TURN_DISABLED   … "1" にすると即座にTURN停止（キルスイッチ）。
//     TURN_TTL        … 認証情報の有効秒数（既定 86400=1日）。
// ============================================================
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': (allowed.length && allowed.includes(origin)) ? origin : (allowed[0] || '*'),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    // オリジン制限（設定時のみ）。ブラウザからの不正サイト利用を弾く。
    if (allowed.length && origin && !allowed.includes(origin)) return json({ error: 'origin_not_allowed' }, 403);
    // キルスイッチ（超過/不正に気づいたら "1" に）
    if (env.TURN_DISABLED === '1') return json({ disabled: true });
    if (!env.TURN_KEY_ID || !env.TURN_TOKEN) return json({ error: 'not_configured' }, 500);

    const r = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate`,
      { method: 'POST', headers: { Authorization: `Bearer ${env.TURN_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl: Number(env.TURN_TTL) || 86400 }) }
    );
    const data = await r.json().catch(() => null);
    if (!r.ok || !data) return json({ error: 'turn_api_failed', status: r.status }, 502);
    return json(data);   // { iceServers: {...} } をそのまま返す
  },
};
