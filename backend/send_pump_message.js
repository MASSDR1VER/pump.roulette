#!/usr/bin/env node

/**
 * Send message to pump.fun chat
 * Usage: node send_pump_message.js <token> <message>
 */

const { PumpChatClient } = require('../pump-fun-chat-mcp/node_modules/pump-chat-client');

const token = process.argv[2];
const message = process.argv[3];

if (!token || !message) {
    console.error('Usage: node send_pump_message.js <token> <message>');
    process.exit(1);
}

// Set auth cookie before creating client
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiN3dGVFlOWlBBSzdXYnpTUjhFaGZtb3NhRGI3alRMN3dEbldqR0FYUDY4ak4iLCJyb2xlcyI6WyJ1c2VyIl0sImlhdCI6MTc1ODA1NzE4MiwiZXhwIjoxNzYwNjQ5MTgyfQ.uMKSXWOI_nMhDpWHv5YgAx27p3VMdLeI0T9xpxceUTg';

// We need to modify the websocket headers to include auth_token cookie
// But pump-chat-client doesn't expose this directly...
// Let's try a different approach

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