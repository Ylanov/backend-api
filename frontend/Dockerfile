# === Build stage ===
FROM node:20-alpine AS build
WORKDIR /app

# Ставим зависимости
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* .npmrc* ./
RUN npm install --legacy-peer-deps

# Копируем код и билдим
COPY . .
# production-окружение (использует .env.production)
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# === Runtime stage ===
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist ./
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
