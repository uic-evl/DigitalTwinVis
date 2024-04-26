FROM python:3.13-slim

RUN python -m pip install -i https://pypi.anaconda.org/scientific-python-nightly-wheels/simple statsmodels --upgrade --use-deprecated=legacy-resolver
RUN pip install scikit-learn scipy numpy pandas simplejson flask flask-cors gunicorn 

