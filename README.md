# PumpRoulette

A web application that pairs two live Pump.fun streams at random (similar to ChatRoulette) with an integrated real-time chat system. Built with a professional, modular architecture using Python (backend) and React/Next.js with shadcn/ui (frontend).

## Features

- 🎲 **Random Stream Pairing**: Randomly pairs two live Pump.fun streams
- 💬 **Real-time Chat**: Independent chat system for users watching the same pair
- 👛 **Wallet Integration**: Support for Phantom, MetaMask, and WalletConnect
- ⭐ **Favorites System**: Save and track favorite streams/tokens
- 📊 **Stream Information**: Display token name, streamer name, contract address, and viewer count
- 📱 **Responsive Design**: Fully functional on desktop and mobile browsers

## Architecture

### Backend (Python)
- **Framework**: FastAPI with async support
- **WebSocket**: Real-time chat using native WebSocket support
- **Structure**: Modular architecture with clear separation of concerns
- **Documentation**: Comprehensive docstrings for all classes and functions

### Frontend (React/Next.js)
- **UI Library**: shadcn/ui for professional, accessible components
- **State Management**: React hooks and context
- **TypeScript**: Full type safety throughout the application
- **Styling**: Tailwind CSS with custom theming

## Project Structure

```
PumpRoulette/
├── backend/
│   ├── api/             # API endpoints
│   ├── config/          # Configuration settings
│   ├── core/            # Core business logic
│   ├── models/          # Data models
│   ├── services/        # Service layer (streams, chat, auth)
│   ├── utils/           # Utility functions
│   └── main.py          # Application entry point
│
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js app directory
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utility libraries
│   │   ├── services/    # API services
│   │   ├── styles/      # Global styles
│   │   └── types/       # TypeScript definitions
│   ├── public/          # Static assets
│   └── package.json     # Dependencies
│
└── docs/
    └── prd.md           # Product Requirements Document
```

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- Redis (for caching and sessions)
- PostgreSQL (optional, for production)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Copy and configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Run the backend server:
```bash
python main.py
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Copy and configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Run the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## API Documentation

Once the backend is running, you can access:
- Interactive API documentation: `http://localhost:8000/docs`
- Alternative API documentation: `http://localhost:8000/redoc`

## Key API Endpoints

### Streams
- `GET /api/v1/streams/live` - Get all live streams
- `GET /api/v1/streams/random-pair` - Get a random pair of streams
- `GET /api/v1/streams/{stream_id}` - Get specific stream details

### Chat
- `WS /api/v1/chat/ws/{room_id}` - WebSocket connection for real-time chat
- `GET /api/v1/chat/room/{room_id}/history` - Get chat history

### Authentication
- `POST /api/v1/auth/wallet/connect` - Connect crypto wallet
- `POST /api/v1/auth/guest/login` - Login as guest

## Environment Variables

### Backend (.env)
```
APP_NAME=PumpRoulette
DEBUG=False
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql+asyncpg://user:password@localhost/pumproulette
REDIS_URL=redis://localhost:6379/0
PUMP_FUN_API_URL=https://api.pump.fun
PUMP_FUN_API_KEY=your-api-key
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/chat/ws
```

## Development

### Running Tests

Backend:
```bash
cd backend
pytest
```

Frontend:
```bash
cd frontend
npm test
```

### Code Quality

Backend:
```bash
black .          # Format code
pylint **/*.py   # Lint code
mypy .           # Type checking
```

Frontend:
```bash
npm run lint     # ESLint
npm run type-check  # TypeScript check
```

## Deployment

### Production Considerations

1. **Security**:
   - Use HTTPS/WSS in production
   - Implement proper CORS configuration
   - Secure WebSocket connections
   - Validate and sanitize all inputs

2. **Scalability**:
   - Use Redis for session management
   - Implement horizontal scaling for WebSocket servers
   - Use CDN for static assets
   - Database connection pooling

3. **Monitoring**:
   - Set up logging aggregation
   - Implement health checks
   - Monitor WebSocket connections
   - Track API performance

## Contributing

1. Follow the existing code style and documentation standards
2. Write comprehensive docstrings for all functions and classes
3. Ensure all tests pass before submitting PR
4. Update documentation for any new features

## License

[Your License Here]

## Support

For issues and questions, please open an issue on GitHub or contact the development team.