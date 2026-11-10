#copiato da https://medium.com/@robinviktorsson/containerizing-a-typescript-node-js-application-with-docker-a-step-by-step-guide-be7fc87191f8

FROM node:26-alpine

ENV PORT=9089
ENV TARGETS_PATH=/etc/prometheus/targets



WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock) first to leverage Docker caching
COPY package*.json ./

RUN npm install

# Copy the rest of the application files
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

RUN mkdir -p $TARGETS_PATH

# Expose the application's port
EXPOSE $PORT/tcp

# Command to start the application
CMD ["npm", "start"]