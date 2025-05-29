mkdir -p data uploads logs
sudo chown -R 1000:1000 data uploads logs
npm install --package-lock-only
sudo docker-compose build --no-cache
sudo docker-compose up -d