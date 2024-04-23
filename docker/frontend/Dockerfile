FROM nginx

WORKDIR /workspace
RUN apt-get update -y && apt-get install -y tmux vim git 
RUN git clone https://github.com/uic-evl/DigitalTwinVis.git
    
# RUN scp /workspace/DigitalTwinVis/docker/frontend/https-forwarding.conf /etc/nginx/conf.d/https-forwarding.conf

# RUN nginx -s reload

# WORKDIR /workspace/DigitalTwinVis/frontend

# RUN npm run build

# CMD ["serve","-s","build","-p","8080","--cors"]