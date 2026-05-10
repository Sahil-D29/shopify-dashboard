# How to Start the Server

## Quick Start

From the **root directory** (`C:\Users\asus\Desktop\Shopify`), run:

```powershell
cd backend\shopify-dashboard
npm run dev
```

Or use the PowerShell script:

```powershell
cd backend\shopify-dashboard
.\start-server.ps1
```

## Important Notes

1. **Always run from `backend/shopify-dashboard` directory** - The `dev` script is only in that package.json
2. **Don't run from root** - The root directory doesn't have a `dev` script
3. **Server runs on port 3002** - Access at `http://localhost:3002`

## Verify Server is Running

After starting, you should see:
```
▲ Next.js 16.0.0 (Turbopack)
- Local:        http://localhost:3002
- Network:      http://192.168.154.241:3002
✓ Ready in X seconds
```

## Troubleshooting

If you see routing errors:
- ✅ Fixed: The routing conflict has been resolved
- The server should start without the `'id' !== 'token'` error

If the server doesn't start:
1. Check if port 3002 is already in use: `netstat -ano | findstr ":3002"`
2. Install dependencies: `npm install`
3. Check for errors in the terminal output

