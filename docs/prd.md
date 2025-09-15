Product Requirements Document (PRD)

Product Name (placeholder): PumpRoulette
Version: v1.0
Owner: [Your Name/Team]
Date: [Insert Date]

⸻

1. Overview

PumpRoulette is a web application that pairs two live Pump.fun streams at random (similar to ChatRoulette) and layers in its own merged chat system for users to interact. The app is designed with a professional, modular architecture—backend written in Python, frontend powered by modern UI libraries. Each stream displays contextual information such as token name, streamer name, and contract address.

⸻

2. Objectives
	•	Help users discover Pump.fun tokens/streamers in a fun, roulette-style way.
	•	Provide a lightweight, app-native chat independent from Pump.fun.
	•	Ensure clean, professional, and maintainable modular codebase.
	•	Deliver a seamless and user-friendly frontend interface using shadcn/ui.
	•	Create shareability and retention with favorites, token tracking, and social features.

⸻

3. Core Features

3.1 Stream Pairing
	•	Randomly select two live Pump.fun streams from metadata source.
	•	Display both streams side-by-side (split screen layout).
	•	“Next” button: skip current pair, load two new random streams.

3.2 Stream Info Overlay

For each stream:
	•	Token name
	•	Streamer name
	•	Contract address (copy-to-clipboard feature)
	•	Live viewer count (if available from Pump.fun data)

3.3 PumpRoulette Chat (Independent)
	•	Shared chat window for all users currently watching the same pair.
	•	Real-time messaging powered by WebSocket / Firebase / custom backend.
	•	Lightweight account system:
	•	Connect crypto wallet
	•	Or temporary guest handle
	•	Basic moderation: block, mute, report abusive users.

3.4 User Interaction
	•	Favorite a stream/token (stored in local profile or DB if wallet connected).
	•	Share button: generate a unique link to the current paired view.

⸻

4. Non-Functional Requirements
	•	Performance:
	•	Streams must load in under 3 seconds.
	•	Scalability:
	•	System supports [X concurrent users] with separate chat rooms.
	•	Compatibility:
	•	Fully functional on desktop and mobile browsers.
	•	Security:
	•	Sanitize all chat inputs.
	•	Validate Pump.fun contract data integrity.
	•	Protect user wallet connection flow.
	•	Code Quality:
	•	All classes, functions, and parameters must include English docstrings/explanations.
	•	Codebase must be modular, professional, and easy to read.

⸻

5. Architecture & Codebase

5.1 Backend
	•	Language: Python
	•	Structure: Modular, well-documented, scalable.
	•	Directory: /backend
	•	Responsibilities:
	•	Fetch Pump.fun live stream metadata.
	•	Random pairing logic for streams.
	•	Chat server (WebSocket / Firebase integration).
	•	User system: wallet connection + guest users.
	•	Token/stream favoriting and saving.

5.2 Frontend
	•	Framework: React (Next.js recommended).
	•	UI Library: shadcn/ui for professional, accessible components.
	•	Directory: /frontend
	•	Responsibilities:
	•	Display paired streams in split view.
	•	Render info overlays (token/streamer/contract).
	•	Interactive chat UI (real-time updates).
	•	User actions (favorite, share, next).
	•	Responsive design for mobile & desktop.

5.3 Code Documentation
	•	Each class, function, and parameter will include an English explanation (docstring + inline comments where needed).
	•	Example format (Python):

class StreamManager:
    """
    Manages Pump.fun stream selection and pairing.
    
    Attributes:
        streams (list): List of currently active streams fetched from Pump.fun.
    """

    def get_random_pair(self) -> tuple:
        """
        Selects two random streams from the active pool.
        
        Returns:
            tuple: A pair of stream objects with metadata.
        """
        pass


⸻

6. Data & Integrations
	•	Pump.fun source: Live streams metadata (token name, streamer name, contract address, stream URL).
	•	WebRTC/RTMP: For embedding live video streams.
	•	Chat Backend: Custom WebSocket server (Python) or Firebase Realtime Database.
	•	Wallet Integration: Support for Web3 wallets (e.g., Phantom, MetaMask).

⸻

7. User Flow
	1.	User opens PumpRoulette → random pair of live Pump.fun streams loads.
	2.	Info overlays display token + streamer names, contract address, and viewer count.
	3.	Shared chat box appears under/next to the streams, specific to that pair.
	4.	User types messages → visible to all users in the same chat room.
	5.	User clicks “Next” → new random streams + new chat room load.
	6.	Optionally: user saves/favorites token or shares current view link.

⸻

8. Future Extensions (v2+)
	•	Leaderboards for most favorited streams/tokens.
	•	Advanced moderation (AI-assisted spam filtering).
	•	Multi-pair roulette (more than 2 streams).
	•	Gamification elements (achievements, badges).
	•	Premium features (priority roulette, no ads).

