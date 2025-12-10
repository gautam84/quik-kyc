# Camera Access Setup

## HTTPS Requirement

**IMPORTANT:** Camera access requires HTTPS (secure connection) to work properly.

### For Development:

The application works on `localhost` without HTTPS, but if you need to test on other devices on your network:

#### Option 1: Use ngrok (Recommended)
```bash
# Install ngrok
npm install -g ngrok

# Start your dev server
npm run dev

# In another terminal, create HTTPS tunnel
ngrok http 3000
```

This will give you an HTTPS URL like `https://abc123.ngrok.io` that you can use for testing.

#### Option 2: Use local HTTPS certificate
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Update package.json dev script:
# "dev": "next dev --experimental-https --experimental-https-key key.pem --experimental-https-cert cert.pem"
```

**Note:** Self-signed certificates will show a browser warning. You'll need to accept it to proceed.

### For Production:

Deploy to a hosting service that provides HTTPS by default:
- **Vercel** (Recommended for Next.js) - Free HTTPS
- **Netlify** - Free HTTPS
- **AWS Amplify** - Free HTTPS
- **Custom Domain** - Use Let's Encrypt for free SSL certificate

### Testing Camera:

1. **On localhost:** Works without HTTPS ✅
2. **On LAN (192.168.x.x):** Requires HTTPS ❌
3. **On Production:** Must have HTTPS ✅

### Browser Support:

| Browser | HTTP Support | HTTPS Support |
|---------|--------------|---------------|
| Chrome | localhost only | ✅ All domains |
| Firefox | localhost only | ✅ All domains |
| Safari | localhost only | ✅ All domains |
| Edge | localhost only | ✅ All domains |

### Common Errors:

**Error:** "getUserMedia is not implemented"
- **Cause:** Accessing over HTTP (not HTTPS) on non-localhost
- **Solution:** Use ngrok or deploy to HTTPS

**Error:** "Permission denied"
- **Cause:** User blocked camera access
- **Solution:** Enable camera in browser settings

**Error:** "No camera found"
- **Cause:** Device doesn't have a camera
- **Solution:** Use a device with a camera

## Quick Start with ngrok:

```bash
# Terminal 1 - Start dev server
npm run dev

# Terminal 2 - Start ngrok tunnel
ngrok http 3000

# Open the ngrok HTTPS URL in your browser
# Example: https://abc123.ngrok-free.app
```

That's it! The camera should now work on any device. 📸
