FROM node:22-alpine

# Hearth resets tasks at local midnight and renews allowance on a local weekday,
# so the container needs real timezone data rather than defaulting to UTC.
RUN apk add --no-cache tzdata

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_FILE=/data/data.json

WORKDIR /app

# The app has no dependencies, so package.json isn't needed in the image.
COPY server.js ./
COPY public ./public

# /data is the only writable path the app needs. Creating it here with the
# right owner means a named volume inherits that ownership on first use.
RUN mkdir -p /data && chown -R node:node /data /app

# Stamped by CI with the commit sha so you can see what's deployed.
ARG BUILD_REF=dev
ENV HEARTH_VERSION=$BUILD_REF

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/profiles',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
