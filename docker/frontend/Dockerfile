FROM node:20

ENV DEBIAN_FRONTEND=noninteractive
RUN echo 'here'
WORKDIR /workspace
RUN apt-get update -y && apt-get install -y tmux git 
RUN git clone https://github.com/uic-evl/DigitalTwinVis.git
WORKDIR /workspace/DigitalTwinVis/frontend

RUN apt-get install -y npm
RUN npm -g install npm@latest
RUN npm install 
RUN npm run build
RUN npm install -g serve
CMD ["serve","-s","build","-p","8000","--cors"]