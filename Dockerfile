FROM nvcr.io/nvidia/pytorch:23.04-py3

RUN apt-get update && apt-get install -y nano ufw tmux
RUN pip3 install scikit-learn numpy pandas simplejson captum flask flask-cors flask-jwt-extended gunicorn
