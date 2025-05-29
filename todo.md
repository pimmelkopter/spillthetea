mkdir -p data uploads logs
sudo chown -R 1000:1000 data uploads logs

npm install -g web-push
web-push generate-vapid-keys
# Output in .env eintragen

npm install --package-lock-only

tar -czf backup-$(date +%Y%m%d).tar.gz data/ uploads/

sudo docker compose down --rmi "all" -v
sudo docker compose build --no-cache
sudo docker compose up -d

localtest:
npm install
npm run setup
npm start
/ oder npm run dev

localhost:3000