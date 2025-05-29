mkdir -p data uploads logs
sudo chown -R 1000:1000 data uploads logs

npm install --package-lock-only

sudo docker compose down --rmi "all" -v
sudo docker compose build --no-cache
sudo docker compose up -d

localtest:
npm install
npm run setup
npm start
/ oder npm run dev

localhost:3000