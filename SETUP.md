# Quick Setup Guide

## Step 1: Create Backend .env File

Create a file named `.env` in the `backend` directory with the following content:

```
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=YOUR_SHOPIFY_ACCESS_TOKEN_HERE
SHOPIFY_API_KEY=YOUR_SHOPIFY_API_KEY_HERE
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET_HERE
```

## Step 2: Install Dependencies

### Backend:
```bash
cd backend
npm install
```

### Frontend:
```bash
cd frontend
npm install
```

## Step 3: Run the Application

### Terminal 1 - Backend:
```bash
cd backend
npm start
```

You should see: `🚀 Server running on port 5000`

### Terminal 2 - Frontend:
```bash
cd frontend
npm start
```

The browser will automatically open to `http://localhost:3000`

## Troubleshooting

1. **Backend won't start**: Check that the `.env` file exists in the `backend` directory
2. **Frontend can't connect**: Make sure backend is running on port 5000 first
3. **API errors**: Verify the Shopify credentials in the `.env` file are correct
4. **CORS errors**: Ensure the backend server is running and accessible

## Project Structure

```
Shopify-Dashboard-Demo/
├── backend/
│   ├── .env              ← CREATE THIS FILE (see Step 1)
│   ├── server.js
│   ├── routes/
│   │   └── shopifyRoutes.js
│   ├── services/
│   │   └── shopifyService.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── pages/
    │   │   └── Dashboard.js
    │   ├── components/
    │   │   └── DataCard.js
    │   └── index.css
    └── package.json
```

