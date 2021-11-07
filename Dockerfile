# https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./

# cant do `npm ci` because tsc has to compile the project first
# which requires devDependencies
RUN npm install 

COPY . .

CMD [ "npm", "start" ]