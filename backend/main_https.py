#!/usr/bin/env python
"""
HTTPS enabled version of PumpRoulette backend for remote access
"""

import uvicorn
import ssl
from main import app

if __name__ == "__main__":
    # Self-signed certificate for development
    ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)

    # Generate self-signed certificate (for development only)
    import os
    if not os.path.exists("cert.pem") or not os.path.exists("key.pem"):
        os.system("openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'")

    ssl_context.load_cert_chain("cert.pem", "key.pem")

    uvicorn.run(
        app,
        host="0.0.0.0",  # Listen on all interfaces
        port=8000,
        ssl_keyfile="key.pem",
        ssl_certfile="cert.pem"
    )