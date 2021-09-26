FROM node

ADD . /app

WORKDIR /app

RUN yarn

ENV NODE_ENV=production

EXPOSE 3000 3002

CMD ["yarn", "serve"]
