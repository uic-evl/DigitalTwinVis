FROM node:20

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /workspace
RUN apt-get update -y 

RUN apt-get install -y npm
RUN npm -g install npm@latest
# CMD ["serve","-s","build","-p","80","--cors"]