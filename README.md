# AI-JEEP

A jeepney monitoring and tracking system with real-time location tracking, emergency alerts, and user management.

## Project Structure

```
AI-JEEP/
├── web/                 # Frontend application (React + Vite + Convex)
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   └── utils/      # Utility functions
│   ├── convex/         # Convex backend functions
│   └── dist/           # Built production files
├── edge/               # Edge ML components (Python)
│   ├── detector.py     # Jeepney detection
│   ├── model_trainer.py
│   └── requirements.txt
└── README.md
```

## Prerequisites

### For Web Application
- Node.js (v18 or higher)
- npm (comes with Node.js)
- A Clerk account (for authentication)

### For Edge/ML Components
- Python 3.8+
- pip (Python package manager)

---

## Running the Web Application

### 1. Navigate to the web directory

```bash
cd web
```

### 2. Install dependencies

```bash
npm install
```

This will install all packages defined in `package.json`:
- React 18 with React DOM
- Vite (build tool)
- Convex (backend)
- Clerk (authentication)
- Leaflet + React-Leaflet (maps)
- Tailwind CSS
- TypeScript

### 3. Configure Environment Variables

Copy the example environment file or create `.env.local`:

```bash
# .env.local is already configured with default values
# Update these for your deployment:

CONVEX_DEPLOYMENT=dev:your-deployment-name
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
CLERK_ISSUER_URL=https://your-clerk-issuer.clerk.accounts.dev
```

### 4. Start the Development Server

```bash
npm run dev
```

This will start the Vite development server. The app will be available at `http://localhost:5173` (default Vite port).

### 5. Start Convex Development (Optional - for local backend)

If you need to run Convex locally for development:

```bash
npx convex dev
```

This starts the Convex dev server and syncs your backend functions.

### 6. Build for Production

```bash
npm run build
```

This compiles TypeScript and builds the production bundle to `web/dist/`.

### 7. Preview Production Build

```bash
npm run preview
```

---

## Running the Edge/ML Components

### 1. Navigate to the edge directory

```bash
cd edge
```

### 2. Create a virtual environment (recommended)

```bash
# On Windows
python -m venv venv
venv\Scripts\activate

# On macOS/Linux
python -m venv venv
source venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

This installs:
- opencv-python - Computer vision library
- mediapipe - Google's ML framework
- protobuf - Protocol buffers
- scikit-learn - Machine learning library
- pyserial - Serial communication
- requests - HTTP requests
- huggingface_hub - Hugging Face integration

### 4. Running the Components

**Mock Data Generator:**
```bash
python mock_data_generator.py
```

**Model Trainer:**
```bash
python model_trainer.py
```

**Detector:**
```bash
python detector.py
```

**Utilities:**
```bash
python utils.py
```

---

## Authentication Setup

This project uses Clerk for authentication. To set up Clerk:

1. Go to [clerk.com](https://clerk.com) and create an account
2. Create a new application
3. Get your Publishable Key and update `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`
4. Configure the Issuer URL from Clerk dashboard and update `CLERK_ISSUER_URL`

---

## Convex Backend Setup

The web app uses Convex as its backend. The deployment is configured in `.env.local`.

To set up your own Convex deployment:

1. Install Convex CLI: `npm install -g convex`
2. Login: `npx convex dev`
3. Follow the prompts to create a deployment
4. Update the environment variables with your new deployment name

---

## Available Scripts

### Web (in web/ directory)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## Technology Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Leaflet** - Maps
- **Convex** - Backend
- **Clerk** - Authentication

### Edge/ML
- **Python** - Programming language
- **OpenCV** - Computer vision
- **MediaPipe** - ML solutions
- **scikit-learn** - Machine learning

---

## License

ISC
