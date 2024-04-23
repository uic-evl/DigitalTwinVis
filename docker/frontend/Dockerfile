FROM node:20

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /workspace
RUN apt-get update -y && apt-get install -y tmux git 
RUN git clone https://github.com/uic-evl/DigitalTwinVis.git
WORKDIR /workspace/DigitalTwinVis/frontend

RUN apt-get install -y npm
RUN npm -g install npm@latest
RUN npm install 
RUN npm run build
RUN npm install -g serve
RUN echo 'here cors and such n'
# CMD ["serve","-s","build","-p","80","--cors"]