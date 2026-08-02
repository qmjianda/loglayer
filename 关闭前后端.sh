pkill -f "backend/main.py" 2>/dev/null; pkill -f "vite" 2>/dev/null; pkill -f "npm run dev" 2>/dev/null; sleep 2; ps aux | grep -E "[m]ain.py|[v]ite" | wc -l; echo "processes rema
ining"; curl -s -o /dev/null -w "backend: %{http_code}\n" http://127.0.0.1:12345/api/platform 2>&1; curl -s -o /
dev/null -w "frontend: %{http_code}\n" http://localhost:3000 2>&1