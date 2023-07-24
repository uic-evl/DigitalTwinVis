from flask import Flask, jsonify, request
from flask_cors import CORS
import simplejson
from AppApi import *

app = Flask(__name__)
CORS(app)
print('code start')
DATA = load_dataset()
decision_model,transition_model1,transition_model2,outcome_model = load_models()
PCAS = get_embedding_pcas(DATA,decision_model,components=10)
embedding_df = get_embedding_df(DATA,decision_model,pcas=PCAS)
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

@app.route('/')
def test():
    return 'test succesful'

    
@app.route('/patientdata',methods=['GET'])
def get_patient_data():
    print('getting patient data')
    patients = request.args.getlist('patientIds')
    fields = request.args.getlist('fields')
    return_vals = get_dataset_jsons(DATA,ids=patients,fields=fields)
    # print('return patient data',return_vals)
    data = responsify(return_vals)
    return data

@app.route('/patientembeddings',methods=['GET'])
def get_patient_embeddings():
    print('getting patient embeddings')
    patients = request.args.getlist('patientIds')
    fields = request.args.getlist('fields')
    return_vals = get_embedding_json(DATA,decision_model,embed_df=embedding_df,ids=patients,fields=fields)
    # print('return patient embeddings',return_vals)
    data = responsify(return_vals)
    return data

@app.route('/newpatient',methods=['POST'])
def get_newpatient_stuff():
    patient_dict = request.get_json(force=True)
    print('_new patient simulation request_')
    print(patient_dict)
    print('---')
    return_vals = get_stuff_for_patient(patient_dict,DATA,transition_model1,transition_model2,outcome_model,decision_model)
    # print(return_vals)
    print('-------')
    return responsify(return_vals)

@app.route('/neighbors',methods=['POST'])
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
    neighbors,similarities,embedding,pca = get_neighbors_and_embedding(patient_dict,DATA,decision_model,embedding_df=embedding_df,state=state,max_neighbors=n,pcas=PCAS)
    return_vals = {
        'neighbors': neighbors.astype(int).tolist(),
        'similarities': similarities.tolist(),
        'embedding': embedding.tolist(),
        'pca': pca.tolist()
    }
    # print(return_vals)
    print('-------')
    return responsify(return_vals)

@app.route('/cohortPredictions',methods=['GET'])
def get_cohort_predictions():
    patients = request.args.getlist('patientIds')
    if len(patients) < 1:
        patients=None
    pdf = get_predictions(DATA,transition_model1,transition_model2,outcome_model,ids=patients)
    pdf_json = pdf.to_dict(orient='index')
    return responsify(pdf_json)

