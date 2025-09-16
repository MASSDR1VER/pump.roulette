Here’s a clean, drop-in Claude Code prompt to implement wallet-gated audio for both creators.

⸻

SYSTEM / DEV PROMPT FOR CLAUDE-CODE

Goal: update the /talk UI so that Streamer A and Streamer B must connect a Solana wallet and be verified as the token/stream owner before the Enable Audio button appears and the LiveKit join runs.

Inputs you already have (from POST /rooms/summon)

{
  "room_id": "9MDAeoag_6JsLKqTr",
  "audio_endpoint": "wss://pump-udxzob1q.livekit.cloud",
  "streamer_a_url": "http://localhost:3001/?room=...&token=...A",
  "streamer_b_url": "http://localhost:3001/?room=...&token=...B",
  "room_token": "server_jwt_for_viewers_or_service"
}

New backend assumptions (add if missing)
 1. GET /api/rooms/:roomId/allowed-wallets → returns:

{
  "roomId": "9MDAeoag_6JsLKqTr",
  "creators": [
    { "role": "A", "pubkey": "CREATOR_A_PUBKEY", "tokenMint": "MINT_A" },
    { "role": "B", "pubkey": "CREATOR_B_PUBKEY", "tokenMint": "MINT_B" }
  ]
}

 2. POST /api/rooms/:roomId/verify (body: { pubkey, role, signature, nonce }) → { ok: true }
 • Server issues a short-lived nonce via GET /api/auth/nonce and expects a signed message (signMessage) from the connected wallet.
 • Server also validates that pubkey matches the expected owner for the role (A or B). Optionally also check they are the token deployer/authorized address for that mint.

If you prefer, embed allowed_wallets in the join JWT under metadata and skip the fetch.

UX changes

States for each creator page (/talk?room=<id>&token=<jwt>):
 1. Parse: read room, token from URL. Decode token metadata.display_name (e.g., “Streamer A” / “Streamer B”) or add role=A|B claim; store role.
 2. Wallet Gate:
 • Show “Connect Wallet to Verify Ownership” button.
 • Support Phantom first (window.solana). If unavailable, show “Install Phantom” link. Keep code modular to add Backpack/Solflare.
 3. Verify:
 • After connect, fetch nonce, signMessage(nonce), POST /verify.
 • If ok:true, show “Enable Audio” button; else show error and keep “Connect” visible.
 4. Enable Audio:
 • Only after verified, run getUserMedia and LiveKit connect using existing logic.
 5. Status banner with 4 chips: Wallet: Connected, Verified, Audio: Off/On, Role: A|B.

Files to modify (or create if missing)
 • web/talk.html (or React page if you used Next)
 • web/js/wallet.js (new small helper)
 • server/routes/rooms.ts for the two endpoints if you don’t have them

Implementation details (TypeScript/JS vanilla; adapt to your stack)

Add wallet helper

// wallet.js
export async function connectPhantom() {
  const provider = window?.solana;
  if (!provider || !provider.isPhantom) throw new Error('Phantom not found');
  const { publicKey } = await provider.connect({ onlyIfTrusted: false });
  return { provider, pubkey: publicKey.toString() };
}

export async function sign(provider, message) {
  const encoded = new TextEncoder().encode(message);
  const { signature } = await provider.signMessage(encoded, 'utf8');
  return Array.from(signature); // or Buffer.from(signature).toString('base64')
}

Talk page changes (high-level)

// parse role from JWT metadata or query (?role=A/B)
const role = getRoleFromJwt(token) || (new URLSearchParams(location.search)).get('role') || 'A';

// UI elements
const connectBtn = byId('connectWallet');
const verifyBtn  = byId('verifyOwner'); // optional if auto on connect
const enableBtn  = byId('enableAudio');
const statusEl   = byId('status');

// flow
let wallet = null;
let verified = false;

connectBtn.onclick = async () => {
  try {
    wallet = await connectPhantom(); // { provider, pubkey }
    status('Wallet connected: ' + wallet.pubkey);
    const { nonce } = await fetch(`/api/auth/nonce`).then(r => r.json());
    const sig = await sign(wallet.provider, `PumpRoulette verify\nRoom:${roomName}\nRole:${role}\nNonce:${nonce}`);
    const res = await fetch(`/api/rooms/${roomName}/verify`, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ pubkey: wallet.pubkey, role, signature: sig, nonce })
    }).then(r=>r.json());
    if (!res.ok) throw new Error(res.error || 'Verification failed');
    verified = true;
    status('Verified. You can enable audio.');
    enableBtn.disabled = false;
  } catch (e) {
    status('Wallet/verify error: ' + e.message);
  }
};

enableBtn.onclick = async () => {
  if (!verified) return status('Please verify ownership first.');
  await joinLiveKitWithMic(); // your existing join logic (getUserMedia + connect)
  status('Audio live');
};