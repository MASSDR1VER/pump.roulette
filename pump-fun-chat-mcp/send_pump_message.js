#!/usr/bin/env node

/**
 * Send message to pump.fun chat
 * Usage: node send_pump_message.js <token> <message> <auth_token>
 */

const { PumpChatClient } = require('./node_modules/pump-chat-client');

const token = process.argv[2];
const message = process.argv[3];
const authToken = process.argv[4];

if (!token || !message || !authToken) {
    console.error('Usage: node send_pump_message.js <token> <message> <auth_token>');
    process.exit(1);
}

// We need to pass auth token to the client somehow
// Since pump-chat-client doesn't support auth directly,
// we'll use the modified version that includes cookie

const client = new PumpChatClient({
    roomId: token,
    username: 'PumpRoulette',
    messageHistoryLimit: 10
});

client.on('connected', () => {
    console.log(`Connected to ${token}`);

    // Wait a bit for room join
    setTimeout(() => {
        console.log(`Sending message: ${message}`);
        client.sendMessage(message);

        // Wait for message to be sent
        setTimeout(() => {
            client.disconnect();
            console.log('Message sent, disconnected');
            process.exit(0);
        }, 2000);
    }, 2000);
});

client.on('error', (error) => {
    console.error('Error:', error);
    process.exit(1);
});

client.on('serverError', (error) => {
    console.error('Server error:', error);
    if (error.error === "Authentication required") {
        console.error('Note: Authentication required to send messages');
    }
});

console.log(`Connecting to pump.fun chat for token: ${token}`);
client.connect();

// Timeout after 10 seconds
setTimeout(() => {
    console.error('Timeout: Could not send message');
    client.disconnect();
    process.exit(1);
}, 10000);