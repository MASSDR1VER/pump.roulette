Got it — here’s an improved PRD focused specifically on the joint audio system, with clear framing around how two creators communicate live while the audience listens along.

⸻

Product Requirements Document (PRD)

Feature: Joint Audio Conversation Between Live Streams
Product Name: PumpRoulette (Audio Layer)
Version: v1.1
Date: [Insert Date]

⸻

1. Overview

PumpRoulette introduces a joint audio layer that allows two Pump.fun creators to talk to each other in real time while their audiences listen in. Viewers see both creators’ live Pump.fun streams side by side, and hear their private dialogue broadcast as a shared audio channel.

This feature is the core differentiator of PumpRoulette: it transforms passive streams into interactive, conversational pairings.

⸻

2. Objectives
 • Enable real-time two-way audio between paired creators.
 • Broadcast that conversation to all viewers of the pair.
 • Keep joining frictionless for creators (one click to allow mic).
 • Deliver a natural, podcast-like feel for audiences.

⸻

3. Core Features

3.1 Creator Join
 • Each creator receives a secure join link when paired.
 • Clicking link → “Join & Allow Mic” → browser requests mic → creator joins.
 • Once both are connected, conversation goes live for audiences.

3.2 Audio Routing
 • Bi-directional low-latency audio (creators hear each other).
 • Mixed feed sent to all viewers of that pair.
 • Mix-minus applied (each creator doesn’t hear their own mic).
 • Codec: Opus, 48 kHz, optimized for voice (<200ms latency).

3.3 Viewer Experience
 • When a pair is active:
 • Two Pump.fun streams side by side.
 • Conversation audio auto-plays (default replaces stream audio).
 • Option to toggle between conversation audio and raw stream audio.
 • Merged chat appears below streams for audience interaction.

3.4 Reliability & Safety
 • Auto-reconnect if a creator drops.
 • If one creator is late, viewers hear the active creator and see “Waiting for partner.”
 • Headphones encouraged; system blocks obvious echo loops (mic+speaker same device).
 • Tokens are time-boxed (JWT) → no unauthorized joins.

⸻

4. Non-Functional Requirements
 • Latency: <200ms for conversation to feel natural.
 • Scalability: 1000+ concurrent viewers per pair.
 • Cross-platform: Chrome/Edge/Firefox desktop; Safari iOS.
 • Security:
 • All joins via signed, short-lived links.
 • Media fully encrypted via WebRTC (DTLS-SRTP).

⸻

5. User Flows

Creator Flow
 1. Creator hits Roulette on their token profile.
 2. PumpRoulette pairs them with another creator.
 3. If other creator is active → both receive join links.
 4. Click link → approve mic → instantly connected.
 5. Their voices are live to each other and to all viewers.

Viewer Flow
 1. Viewer lands on a paired page.
 2. Sees both streams side by side.
 3. Hears joint audio conversation by default.
 4. Can switch to raw stream audio if desired.
 5. Joins merged chat to interact.

⸻

6. Technical Approach
 • SFU (Selective Forwarding Unit): LiveKit/mediasoup manages audio room.
 • Room per pair: pair_{id} created on matchmaking.
 • Roles:
 • creator → publish mic, subscribe to partner.
 • audience → subscribe only.
 • Audio tracks: each creator publishes; audience plays both.
 • Scaling: LiveKit handles replication for 1000s of listeners.

⸻

7. Future Enhancements
 • Server-side single mixed audio feed (instead of two separate tracks).
 • Push-to-talk mode for creators.
 • Subtitles/translations for live conversation.
 • Ability to clip/replay highlights of best dialogues.

⸻

8. Open Questions
 • Should the conversation audio also be fed back into each creator’s Pump.fun broadcast, or remain exclusive to PumpRoulette viewers?
 • Do viewers need per-creator volume sliders, or is a single mix enough?
 • Should conversations be ephemeral only, or optionally recorded for highlight reels?

⸻

👉 This reframes the PRD so it’s 100% centered on the conversation-as-content — creators talking, audience listening.