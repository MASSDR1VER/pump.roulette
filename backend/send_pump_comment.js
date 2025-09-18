#!/usr/bin/env node

/**
 * Send comment to pump.fun via API
 * Usage: node send_pump_comment.js <token> <comment>
 */

const token = process.argv[2];
const comment = process.argv[3];

if (!token || !comment) {
    console.error('Usage: node send_pump_comment.js <token> <comment>');
    process.exit(1);
}

const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiN3dGVFlOWlBBSzdXYnpTUjhFaGZtb3NhRGI3alRMN3dEbldqR0FYUDY4ak4iLCJyb2xlcyI6WyJ1c2VyIl0sImlhdCI6MTc1ODA1NzE4MiwiZXhwIjoxNzYwNjQ5MTgyfQ.uMKSXWOI_nMhDpWHv5YgAx27p3VMdLeI0T9xpxceUTg';

async function postComment() {
    try {
        const response = await fetch('https://frontend-api-v3.pump.fun/replies', {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'origin': 'https://pump.fun',
                'priority': 'u=1, i',
                'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Cookie': `auth_token=${authToken}`
            },
            body: JSON.stringify({
                text: comment,
                mint: token
            })
        });

        if (response.status === 201) {
            console.log('Comment posted successfully');
            process.exit(0);
        } else {
            const text = await response.text();
            console.error(`Failed to post comment. Status: ${response.status}`);
            console.error(`Response: ${text.substring(0, 500)}`);
            process.exit(1);
        }
    } catch (error) {
        console.error('Error posting comment:', error.message);
        process.exit(1);
    }
}

postComment();