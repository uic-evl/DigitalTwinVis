FROM nvcr.io/nvidia/pytorch:23.04-py3

RUN apt-get update && apt-get install -y nano 
RUN apt-get install -y ufw 
RUN apt-get install -y tmux
RUN pip3 install scikit-learn numpy pandas simplejson captum flask flask-cors flask-jwt-extended gunicorn
# solving running error on MacOS
ENV LD_PRELOAD=/usr/local/lib/python3.8/dist-packages/sklearn/__check_build/../../scikit_learn.libs/libgomp-d22c30c5.so.1.0.0