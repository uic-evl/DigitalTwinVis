FROM node:20

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /workspace
RUN apt-get update -y && apt-get install -y tmux git 
RUN echo 'here cors and such 9'
RUN git clone https://github.com/uic-evl/DigitalTwinVis.git
WORKDIR /workspace/DigitalTwinVis/frontend

RUN apt-get install -y npm
RUN npm -g install npm@latest
RUN npm install 
RUN npm run build
RUN npm install -g serve

# CMD ["serve","-s","build","-p","80","--cors"]