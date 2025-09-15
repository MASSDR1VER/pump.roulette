Pump.fun Live API Documentation (Unofficial)

Overview

Pump.fun provides live updates about newly created and actively trading tokens via WebSocket connections.
This API is not officially documented but can be accessed by connecting to the appropriate endpoints.

There are two main layers:
	1.	Trade + Token Metadata Stream (gives all new live tokens + trade events)
	2.	Live Stream Data (subscribes to Solana accounts for token-specific events/streams)

⸻

1. Trade + Token Metadata Stream

Endpoint:

wss://frontend-api-v3.pump.fun/socket.io/?EIO=4&transport=websocket

Handshake Flow:
	1.	Connect via WebSocket.
	2.	First server message:

0{
  "sid": "Tvkm4-ouqg47da4JArBa",
  "upgrades": [],
  "pingInterval": 25000,
  "pingTimeout": 20000,
  "maxPayload": 1000000
}

	3.	Client must respond with:

40


⸻

Event: tradeCreated

Message format:

42[
  "tradeCreated",
  {
    "signature": "2B2ncbdCYbuEPgSpFxpXCpfMJ65ikWi5xfvNjaCj2hPjvncoCSNegTDkQa4dcdCooxaWsu8qJ2ScqHHgczq2bBiu",
    "sol_amount": 444376895,
    "token_amount": 9981312192314,
    "is_buy": false,
    "user": "CC9zRJY6fZV2VY45UaFAMZqa92LiC1ZFuMdLeZM9RkTk",
    "timestamp": 1757873685,
    "mint": "6XZvbJBKrD785ff49XeV91sg75pgjpF6WikKJUuppump",
    "virtual_sol_reserves": 37635133139,
    "virtual_token_reserves": 855317820230750,
    "slot": 366818376,
    "tx_index": 1,
    "name": "PUMP FUN FOR  THE WIN !!!!!",
    "symbol": "WIN",
    "description": "LETS SEE WHERE THIS TAKES US! I WANT A HELLCAT!",
    "image_uri": "https://ipfs.io/ipfs/...",
    "metadata_uri": "https://ipfs.io/ipfs/...",
    "bonding_curve": "Gr2bhRpSkv2VBu2uen6ce7eLfTnr15qdAHpA7GG7KBmA",
    "creator": "7szQhDQDb9DGxJCqr9RHUxFXRGpsX3xH2s772hJqWSQt",
    "created_timestamp": 1757873540400,
    "total_supply": 1000000000000000,
    "market_cap": 42.54,
    "usd_market_cap": 10532.96,
    "is_currently_live": true
  }
]

Important Fields:
	•	mint: Token’s unique Solana mint address → used to build live stream URL.
	•	name, symbol, description, image_uri: Token metadata.
	•	sol_amount, token_amount: Trade values.
	•	market_cap / usd_market_cap: Market capitalization.
	•	creator: Creator’s wallet address.

Usage:
Every new live token will be broadcast here.

⸻

2. Live Stream Subscription

URL Pattern:

https://pump.fun/coin/{mint}

Example:

https://pump.fun/coin/FzKjar3rWDdvyKnmTbFxnSeDhq1Yb4kMWFp4fn7Spump


⸻

Endpoint for Live Data (Helius RPC):

wss://pump-fe.helius-rpc.com/?api-key={API_KEY}

Handshake:
Client sends initial subscription message:

{
  "jsonrpc": "2.0",
  "method": "accountSubscribe",
  "params": [
    "So11111111111111111111111111111111111111112",
    { "encoding": "base64", "commitment": "processed" }
  ],
  "id": 1
}


⸻

Example Notification Response:

{
  "jsonrpc":"2.0",
  "method":"accountNotification",
  "params":{
    "result":{
      "context":{"slot":366820612},
      "value":{
        "lamports":18374406,
        "data":["...","base64"],
        "owner":"pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
        "executable":false,
        "rentEpoch":18446744073709551615,
        "space":2512
      }
    },
    "subscription":7824571
  }
}


⸻

3. Integration Notes
	•	Discover Tokens:
Subscribe to wss://frontend-api-v3.pump.fun/.... Every tradeCreated event contains a new token with mint.
	•	Fetch Live Stream:
Construct URL:

https://pump.fun/coin/{mint}

Example:

https://pump.fun/coin/FzKjar3rWDdvyKnmTbFxnSeDhq1Yb4kMWFp4fn7Spump


	•	Subscribe to On-Chain Data:
Use wss://pump-fe.helius-rpc.com/... with account subscriptions to track live Solana data for token.

⸻

4. Roadmap for Backend Integration (Python)
	•	Use websockets or socket.io-client (Python) for Pump.fun metadata stream.
	•	Parse 42["tradeCreated", {...}] events → store tokens in DB.
	•	With mint, generate live stream URLs.
	•	Optionally, subscribe to Helius RPC WebSocket for real-time account updates.

