# Quick Tunnel Setup Guide

## Option 1: Using Localtunnel (Easiest - Already Installed)

1. **Make sure your backend is running:**
   ```powershell
   cd backend
   npm start
   ```
   (Keep this terminal running)

2. **In a NEW terminal, start the tunnel:**
   ```powershell
   lt --port 5000
   ```

3. **You'll see output like:**
   ```
   your url is: https://random-name.loca.lt
   ```

4. **Copy that URL and use it as your callback:**
   ```
   https://random-name.loca.lt/api/webhooks/whatsapp
   ```

## Option 2: Using ngrok (If Windows Defender allows)

1. **If ngrok is blocked, add Windows Defender exception first**

2. **In a NEW terminal, start ngrok:**
   ```powershell
   ngrok http 5000
   ```

3. **You'll see output like:**
   ```
   Forwarding    https://abc123.ngrok-free.app -> http://localhost:5000
   ```

4. **Copy that URL and use it as your callback:**
   ```
   https://abc123.ngrok-free.app/api/webhooks/whatsapp
   ```

## Important Notes:

- ✅ **VERIFY TOKEN**: `6b4e51b2f6e18c99f0ba47f75507c9eb3d03a87032a200d443833f84f3c76471`
- ⚠️ Replace `YOUR_NGROK_URL` with your ACTUAL tunnel URL
- ⚠️ The tunnel must be running when Meta tries to verify
- ⚠️ Make sure your backend is running on port 5000

