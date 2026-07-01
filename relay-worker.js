// ============================================================
// SUGAR WARS — Cloudflare Worker + Durable Object：PVP中継サーバー（非P2P）
// ------------------------------------------------------------
// 役割：P2P(WebRTC)の代わりに、1部屋=1 Durable Object に2人のWebSocketを繋ぎ、
//       片方から来たメッセージをもう片方へ「そのまま転送」するだけの中継。
//       戦闘計算は今まで通り親クライアントが行う（ホスト権威は不変）。
//
// クライアントは wss://<worker>/ws/<あいことば>?role=host|guest に接続する。
// サーバー制御メッセージ（対戦データと混ざらないよう __relay を持つ）：
//   {__relay:'ready'}      2人そろった（両者へ）＝クライアントはここで onOpen
//   {__relay:'peer-left'}  相手が退出
//   {__relay:'full'}       すでに2人いる（満室）
//
// デプロイ手順は RELAY_SETUP.md 参照（wrangler deploy）。
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('sugarwars relay ok', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    // /ws/<code> だけ受け付ける（codeは英数記号1〜32文字）
    const m = url.pathname.match(/^\/ws\/([A-Za-z0-9_-]{1,32})$/);
    if (!m) return new Response('not found', { status: 404 });
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const code = m[1].toUpperCase();
    // あいことば(code)ごとに同じ Durable Object（=同じ部屋）へルーティング
    const id = env.ROOM.idFromName(code);
    const stub = env.ROOM.get(id);
    return stub.fetch(request);
  },
};

// 1部屋ぶんの状態を持つ Durable Object。最大2人。メッセージは相手へ素通し。
export class Room {
  constructor(state, env) {
    this.state = state;
    this.sessions = [];   // { ws, role }
  }
  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    server.accept();

    // 満室（既に2人）なら断る
    if (this.sessions.length >= 2) {
      try { server.send(JSON.stringify({ __relay: 'full' })); } catch (e) {}
      try { server.close(1013, 'room full'); } catch (e) {}
      return new Response(null, { status: 101, webSocket: client });
    }

    const sess = { ws: server, role };
    this.sessions.push(sess);

    server.addEventListener('message', (evt) => {
      // 相手（自分以外）へそのまま転送
      for (const s of this.sessions) {
        if (s !== sess) { try { s.ws.send(evt.data); } catch (e) {} }
      }
    });
    const bye = () => {
      this.sessions = this.sessions.filter((s) => s !== sess);
      for (const s of this.sessions) { try { s.ws.send(JSON.stringify({ __relay: 'peer-left' })); } catch (e) {} }
    };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);

    // 2人そろったら両者に ready（クライアントはここで対戦開始フローへ）
    if (this.sessions.length === 2) {
      for (const s of this.sessions) { try { s.ws.send(JSON.stringify({ __relay: 'ready' })); } catch (e) {} }
    }
    return new Response(null, { status: 101, webSocket: client });
  }
}
