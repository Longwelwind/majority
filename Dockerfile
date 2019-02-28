FROM node

WORKDIR /usr/src/app

COPY package.json .
RUN yarn install --production

COPY . .

# Build the assets for the client-side
RUN yarn run build-client

RUN cp -r dist/. public/

CMD ["yarn", "run-server"]
