FROM nginx

RUN apt-get update \
    && git clone https://github.com/uic-evl/DigitalTwinVis.git
    
COPY DigitalTwinVis/docker/fronted/https-forwarding.conf /etc/nginx/sites-enabled/https-forwarding.conf

RUN systemctl restart nginx

WORKDIR /workspace/DigitalTwinVis/frontend

RUN npm run build

CMD ["serve","-s","build","-p","8080","--cors"]