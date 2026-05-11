# 🔄 Server Restart Instructions

## Why the `/health` endpoint isn't working

The server is running an **old version** without the `/health` endpoint. You need to **restart the server** to load the new code.

## ✅ Steps to Fix

### 1. **Stop the Current Server**
- Find the terminal where the server is running
- Press `Ctrl + C` to stop it
- Or kill the process:
  ```powershell
  # Find and kill Node processes on port 5000
  Get-Process -Name node | Where-Object {$_.Id -eq <PID>} | Stop-Process -Force
  ```

### 2. **Restart the Server**
```powershell
cd backend
npm run dev
```

### 3. **Verify Server Started**
You should see:
```
🚀 Server running on port 5000
📋 Environment: Development
🔒 CSP Status: DISABLED (Development)
🌐 Health check: http://localhost:5000/health
```

### 4. **Test the Health Endpoint**
```powershell
# In PowerShell, use Invoke-WebRequest instead of curl
Invoke-WebRequest -Uri http://localhost:5000/health | Select-Object -ExpandProperty Content

# Or use curl.exe (if available)
curl.exe http://localhost:5000/health
```

## 🔍 Alternative: Check if Server is Running

```powershell
# Check what's running on port 5000
netstat -ano | findstr :5000
```

## ⚠️ Important

- **Always restart the server** after making changes to `server.js`
- The old server instance doesn't have the `/health` endpoint
- Multiple Node processes might be running - make sure you restart the correct one

