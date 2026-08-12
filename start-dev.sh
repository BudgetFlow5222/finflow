#!/usr/bin/env bash
# Fully detach the Next.js dev server so it survives the parent shell exit.
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
rm -f dev.log

# Double-fork daemonization: child becomes init's child, immune to process-group kills.
(
  exec bun run next dev -p 3000 > /home/z/my-project/dev.log 2>&1
) &

SERVER_PID=$!
disown $SERVER_PID 2>/dev/null || true

# Wait until port 3000 responds or timeout
for i in $(seq 1 30); do
  if curl -s -o /dev/null --max-time 1 http://127.0.0.1:3000/ 2>/dev/null; then
    echo "Server is up (pid $SERVER_PID) after ${i}s"
    exit 0
  fi
  sleep 1
done
echo "Server did not become ready in 30s"
cat /home/z/my-project/dev.log
exit 1
