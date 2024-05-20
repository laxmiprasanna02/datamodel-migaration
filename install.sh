npm install -g aws-cdk
npm install ts-node@latest
rm package-lock.json
npm cache clean --force
npm install
npm install ts-node --legacy-peer-deps
(cd lib/infrastructure/backend && npm cache clean --force)
(cd lib/infrastructure/backend && npm i --omit=optional && npm build)

