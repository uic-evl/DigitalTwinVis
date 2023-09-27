from flask import Flask, jsonify, request
from flask_cors import CORS
import simplejson
from datetime import timedelta

from Security import check_password, load_secret_key

from flask_jwt_extended import create_access_token
from flask_jwt_extended import get_jwt_identity
from flask_jwt_extended import jwt_required
from flask_jwt_extended import JWTManager

from AppApi import *

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = load_secret_key()
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=.1)

jwt = JWTManager(app)
CORS(app)
print('code start')
DATA = load_dataset()
decision_model,transition_model1,transition_model2,outcome_model = load_models()
PCAS = get_embedding_pcas(DATA,decision_model,components=10)
embedding_df = get_embedding_df(DATA,decision_model,pcas=PCAS)
m_dists = [test_mahalanobis_distances(DATA,decision_model,s,embedding_df).tolist() for s in [0,1,2]]
DEFAULT_DECISIONS = get_default_prediction_json(decision_model)
print('stuff loaded')

def responsify(dictionary,convert=True):
    # djson = nested_responsify(dictionary) #simplejson.dumps(dictionary,default=np_converter,ignore_nan=True)
    if isinstance(dictionary,str) or (not convert):
        djson = dictionary
    else:
        djson = simplejson.dumps(dictionary,default=np_converter,ignore_nan=True)
    resp = app.response_class(
        response=djson,
        mimetype='application/json',
        status=200
    )
    return resp

@app.route('/login',methods=['GET','POST'])
def login():
    username = request.args.get('username',None)
    password = request.args.get('password',None)
    valid = check_password(username,password)
    if not valid:
        return jsonify({"msg": "Bad username or password"}), 401
    access_token = create_access_token(identity=username)
    return jsonify(access_token=access_token)

@app.route('/')
def test():
    return 'test succesful'

@app.route('/defaultPredictions',methods=['GET'])
@jwt_required()
def get_default_predictions():
    res = responsify(DEFAULT_DECISIONS)
    return res

@app.route('/mahalanobis_histogram',methods=['GET'])
@jwt_required()
def get_mdists():
    res = {i: v for i,v in enumerate(m_dists)}
    res = responsify(res)
    return res 

@app.route('/patientdata',methods=['GET'])
@jwt_required()
def get_patient_data():
    print('getting patient data')
    patients = request.args.getlist('patientIds')
    fields = request.args.getlist('fields')
    return_vals = get_dataset_jsons(DATA,ids=patients,fields=fields)
    # print('return patient data',return_vals)
    data = responsify(return_vals)
    return data

@app.route('/patientembeddings',methods=['GET'])
@jwt_required()
def get_patient_embeddings():
    print('getting patient embeddings')
    patients = request.args.getlist('patientIds')
    fields = request.args.getlist('fields')
    return_vals = get_embedding_json(DATA,decision_model,embed_df=embedding_df,ids=patients,fields=fields)
    # print('return patient embeddings',return_vals)
    data = responsify(return_vals)
    return data

@app.route('/newpatient',methods=['POST'])
@jwt_required()
def get_newpatient_stuff():
    patient_dict = request.get_json(force=True)
    print('_new patient simulation request_')
    print(patient_dict)
    print('---')
    state = patient_dict.get('state',0)
    model_type = patient_dict.get('model','optimal')
    #I this this is unneccesary but just in case I edit something that causes a bug I'm deleteing this from the model args
    if 'state' in patient_dict:
        del patient_dict['state']
    if 'model' in patient_dict:
        del patient_dict['model']
    return_vals = get_stuff_for_patient(patient_dict,DATA,transition_model1,transition_model2,outcome_model,decision_model,state=state,pcas=PCAS,embedding_df=embedding_df,model_type=model_type)
    # print(return_vals)
    print('-------')
    return responsify(return_vals)

@app.route('/neighbors',methods=['POST'])
@jwt_required()
def get_patient_neighbors():
    patient_dict = request.get_json(force=True)
    state=2
    n = 300
    # state = request.get('state')
    # if state is None:
    #     state = 2
    # n = request.get('n_neighbors')
    # if n is None:
    #     n = 100
    print('_new patient neibhors request_')
    print(patient_dict)
    print('---')
    neighbors,similarities,embedding,pca,mDist = get_neighbors_and_embedding(patient_dict,DATA,decision_model,embedding_df=embedding_df,state=state,max_neighbors=n,pcas=PCAS)
    return_vals = {
        'neighbors': neighbors.astype(int).tolist(),
        'similarities': similarities.tolist(),
        'embedding': embedding.tolist(),
        'pca': pca.tolist(),
        'mahalanobisDistance': mDist,
    }
    # print(return_vals)
    print('-------')
    return responsify(return_vals)

@app.route('/cohortPredictions',methods=['GET'])
@jwt_required()
def get_cohort_predictions():
    patients = request.args.getlist('patientIds')
    if len(patients) < 1:
        patients=None
    pdf = get_predictions(DATA,transition_model1,transition_model2,outcome_model,ids=patients)
    pdf_json = pdf.to_dict(orient='index')
    return responsify(pdf_json)

