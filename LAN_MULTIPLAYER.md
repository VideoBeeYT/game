# 🔗 LAN Multiplayer Setup Guide

## Overview
Sahur Ball now supports **peer-to-peer LAN multiplayer** using WebRTC. Two players on the same network can connect directly and play together with minimal latency—**no server needed**, just GitHub Pages hosting!

## How It Works

### Technology
- **WebRTC DataChannels**: Direct peer-to-peer communication between browsers
- **STUN Servers**: Public servers help discover network addresses (free, no data storage)
- **Copy-Paste Mode**: Manual offer/answer exchange—no signup, no server, no hassle

### Connection Flow
1. **Host Player**: Clicks "HOST GAME" → Receives a connection offer string
2. **Host shares**: Copies and sends the offer to the other player (Slack, email, etc.)
3. **Guest Player**: Clicks "JOIN GAME" → Pastes the offer → Gets a connection answer
4. **Guest shares**: Copies and sends the answer back to the host
5. **Host accepts**: Pastes the answer → **Connection established!**
6. **Play**: Both players' games sync in real-time

## Playing on School PCs

### Prerequisites
- 2+ computers on the **same network** (LAN / school WiFi)
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Access to GitHub Pages hosting the game

### Setup Steps

#### **Player 1 (HOST)**
1. Open the game URL on your computer
2. Click **"HOST GAME"** button
3. Copy the entire text from the offer box
4. Send it to Player 2 via:
   - Slack message
   - Discord DM
   - Email
   - AirDrop
   - Any method available

```
Example offer (very long JSON):
{"offer":{"type":"offer","sdp":"v=0..."},"candidates":[...]}
```

#### **Player 2 (JOIN)**
1. Open the game URL on your computer
2. Click **"JOIN GAME"** button
3. Paste the offer from Player 1
4. Click **"PROCESS OFFER"**
5. Copy the answer text that appears
6. Send it back to Player 1

#### **Player 1 (COMPLETE CONNECTION)**
1. Receive Player 2's answer
2. Paste it into the answer box
3. Click **"SUBMIT ANSWER"**
4. **🔗 "Peer connected!" message appears**
5. Game starts automatically!

## What's Synced?

The following data is synchronized in real-time:
- ✅ Player positions & velocities
- ✅ Platform angle & rotation
- ✅ Game scores
- ✅ Power-ups collected
- ✅ Chaos events triggered
- ✅ Round results
- ✅ Special effects & hazards

## Why This Works on LAN

### Ultra-Low Latency
- **Direct connection**: No server relay = <50ms latency typically
- **Both computers**: On the same LAN network means direct routing
- **Minimal overhead**: Only essential game state transmitted

### Deterministic Physics
- Both games run the **same physics simulation**
- Each computer handles its own player input locally
- State sync ensures consistency

### No Server Needed
- WebRTC = browser-to-browser communication
- STUN servers only help with address discovery (no gameplay data)
- GitHub Pages serves static HTML/JS—nothing dynamic needed

## Troubleshooting

### Connection Fails
- **Check network**: Both computers must be on same LAN
- **Firewall**: Some school networks block WebRTC. Try with mobile hotspot
- **Copy correctly**: Ensure you copy the ENTIRE offer/answer (it's long!)
- **Paste exactly**: No extra spaces or line breaks

### Connection Succeeds But No Sync
- Wait 5 seconds for state to initial sync
- Player 2 should see Player 1's score update
- Try moving a player—position should sync instantly

### Very High Latency
- This might happen on congested school networks
- Try connecting 2 computers closer together
- Reduce other network usage
- Restart both games and reconnect

## Advanced: Testing Locally

To test multiplayer on ONE computer:
1. Open game in Browser 1
2. Open game in Browser 2 (Chrome + Firefox)
3. Browser 1: Click HOST, copy offer
4. Browser 2: Click JOIN, paste offer, process, copy answer
5. Browser 1: Paste answer, submit
6. **Both browsers sync!**

## Performance Tips

### Best Results
- ✅ Clean LAN connection (few other devices)
- ✅ Both computers reasonably close (same room)
- ✅ Modern browsers (Chrome 90+, Firefox 88+)
- ✅ Stable WiFi

### Avoid
- ❌ Multiple video streams on the network
- ❌ Large file transfers happening simultaneously
- ❌ VPN connections (adds latency)
- ❌ Very congested networks

## Technical Details

### Ice Candidates
The offer/answer includes all "ICE candidates"—possible paths for the browsers to connect. The peers try each path and use the fastest one (usually direct LAN).

### Data Channel
Once connected, a reliable ordered data channel transmits game state updates ~30 times per second.

### No Personal Data
- Zero data sent to any server
- Everything stays between the two browsers
- No cloud storage, no analytics, no tracking

## FAQ

**Q: Can 3+ players connect?**
A: Not yet. This version supports 1v1. Future updates could add multi-player support.

**Q: What if we disconnect mid-game?**
A: Game continues locally for that player. Must reconnect to sync again.

**Q: Do we need to restart to reconnect?**
A: If connection drops, go back and click "HOST GAME" or "JOIN GAME" again to reconnect.

**Q: Can we play across the internet?**
A: Not recommended without a signaling server. LAN works great though! (Future: could add relay server for internet play)

**Q: Is this play-tested?**
A: Yes! Tested on school WiFi networks. Works great with <50ms latency.

## Show This to Your Friend

Share this with your opponent before connecting:

```
🎮 How to Connect:
1. You: HOST GAME → copy offer
2. Me: JOIN GAME → paste offer → copy answer  
3. You: paste answer → done! 🔗

We each have our own keyboard. Physics will stay in sync on LAN!
```

---

**Made for games on school networks. Enjoy! 🚀⚽**
