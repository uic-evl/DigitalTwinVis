from flask import Flask, jsonify, request
from flask_cors import CORS
import simplejson
from AppApi import *

app = Flask(__name__)
CORS(app)
print('code start')
DATA = load_dataset()
decision_model,transition_model1,transition_model2,outcome_model = load_models()
embedding_df = get_embedding_df(DATA,decision_model)
print('stuff loaded')

def responsify(dictionary):
    # djson = nested_responsify(dictionary) #simplejson.dumps(dictionary,default=np_converter,ignore_nan=True)
    if isinstance(dictionary,str):
        djson = dictionary
    else:
        djson = simplejson.dumps(dictionary,default=np_converter,ignore_nan=True)
    resp = app.response_class(
        response=djson,
        mimetype='application/json',
        status=200
    )
    return resp

@app.route('/')
def test():
    return 'test succesful'

    
@app.route('/patientdata',methods=['GET'])
def get_patient_data():
    print('getting patient data')
    patients = request.args.getlist('patientIds')
    fields = request.args.getlist('fields')
    return_vals = get_dataset_jsons(DATA,ids=patients,fields=fields)
    print('return patient data',return_vals)
    data = responsify(return_vals)
    return data

@app.route('/patientembeddings',methods=['GET'])
def get_patient_embeddings():
    print('getting patient embeddings')
    patients = request.args.getlist('patientIds')
    fields = request.args.getlist('fields')
    return_vals = get_embedding_json(DATA,decision_model,ids=patients,fields=fields)
    print('return patient embeddings',return_vals)
    data = responsify(return_vals)
    return data

@app.route('/newpatient',methods=['POST'])
def get_newpatient_stuff():
    patient_dict = request.get_json(force=True)
    print('_new patient simulation request_')
    print(patient_dict)
    print('---')
    return_vals = get_stuff_for_patient(patient_dict,DATA,transition_model1,transition_model2,outcome_model,decision_model)
    print(return_vals)
    print('-------')
    return responsify(return_vals)

@app.route('/neighbors',methods=['POST'])
def get_patient_neighbors():
    patient_dict = request.get_json(force=True)
    state = request.get('state')
    if state is None:
        state = 2
    n = request.get('n_neighbors')
    if n is None:
        n = 100
    print('_new patient neibhors request_')
    print(patient_dict)
    print('---')
    neighbors,similarities = get_neighbors_and_embedding(patient_dict,DATA,decision_model,embedding_df=embedding_df,state=state,max_neighbors=n)
    return_vals = {
        'neighbors': neighbors.astype(int).tolist(),
        'similarities': similarities.tolist()
    }
    print(return_vals)
    print('-------')
    return responsify(return_vals)

# @app.route('/mdasi')
# def get_mdasi():
#     data = load_mdasi_data()
#     response = responsify(data)
#     return response
