# Stage 1: Build
FROM node:20.0.0 AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20.0.0
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=build /app/dist ./dist
COPY zaver-app-production-66642ceddc7b.json ./zaver-app-production-66642ceddc7b.json
CMD ["npm", "run", "start:prod"]
