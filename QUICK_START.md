# 🎮 Quick Start: School Network LAN Play

## The 30-Second Version

**Two students, same WiFi → Multiplayer Game**

### Player 1 (Host)
1. Open game, click "HOST GAME"
2. Copy the long text that appears
3. Send to Player 2 via Slack/Discord/text

### Player 2 (Guest)  
1. Open game, click "JOIN GAME"
2. Paste what Player 1 sent
3. Click "PROCESS OFFER"
4. Copy the answer text that appears
5. Send back to Player 1

### Player 1 (Finish)
1. Paste the answer Player 2 sent
2. Click "SUBMIT ANSWER"
3. **CONNECTED!** Game starts ⚽

---

## Testing Locally (One Computer)

Open **TWO browser windows**:
- Browser 1: Host
- Browser 2: Join

Copy/paste between them. **Both windows' games will sync!**

---

## Why It Works

- **No Server**: Pure peer-to-peer using WebRTC
- **No Install**: Just open the GitHub Pages URL
- **No Signup**: No accounts, no login
- **Super Fast**: Direct connection on LAN = <50ms latency
- **School Friendly**: Works on school WiFi (most of the time)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection fails | Make sure both computers are on the **same network** |
| Can't copy/paste | Try highlighting the text first, then copy |
| Still says "connecting" after 30s | Connection might have failed - go back and try again |
| Game has no delay but no sync | That's single-player mode - close modal and try multiplayer again |

---

## Advanced: What's Being Sent?

Only this data (minimal bandwidth):
- ✅ Scores
- ✅ Game state changes  
- ✅ Chaos events triggered
- ✅ Round end results

**NOT sent**: player positions (calculated locally from physics), full state dump

This makes it blazingly fast on school networks!

---

## Playing Against Each Other

Each player controls their own character (A/D + W for Player 1, Arrow Keys for Player 2). The rest syncs automatically. **You should see matching scores and events on both screens.**

---

## Have Fun! ⚽✨

Made for fun on school networks. Enjoy the chaos!
