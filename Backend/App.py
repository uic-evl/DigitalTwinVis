from flask import Flask, jsonify, request
from flask_cors import CORS
import simplejson
import pickle
from AppApi import *

app = Flask(__name__)
CORS(app)
print('code start')
# dicom_data = load_dicom_data()
# FIELD_KEYS = ['patient_id','study_uid','series_uid','roi_mask_map','point_clouds']
PATIENT_IDS = get_all_pids()
print('patient ids',PATIENT_IDS)
PARAMETERS = get_patient_parameters()
# ROI_MAP = dicom_data[0]['roi_mask_map']
# ROIS = list(ROI_MAP.values())
# dicom_data = {i['id']: i for i in dicom_data}
# print('data loaded')

def as_float(item):
    if item is None:
        return item
    try:
        item = float(item)
        return item
    except:
        return None

def responsify(dictionary):
    # djson = nested_responsify(dictionary) #simplejson.dumps(dictionary,default=np_converter,ignore_nan=True)
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

@app.route('/parameters')
def get_parameters():
    data = {k:v for k,v in PARAMETERS.items() if v is not None}
    data['patientIDs'] = PATIENT_IDS[:]
    response = responsify(data)
    return response
    
# @app.route('/patientdata',methods=['GET'])
# def get_patient_data():
#     print('getting patient data')
#     patients = request.args.getlist('patientIds')
#     fields = request.args.getlist('patientFields')
#     if patients is None or len(patients) <= 0:
#         patients = list(dicom_data.keys())[0:2]
#     if fields is None or len(fields) <= 0:
#         fields = ['id','contours','contour_values','distances']
#     patients = [int(p) for p in patients if int(p) in dicom_data.keys()]
#     fields = [f for f in fields if f in FIELD_KEYS]
#     print('f and p',fields,patients)
#     return_vals = [dicom_data[p] for p in patients]
#     return_vals = [{f: x[f] for f in fields} for x in return_vals]
#     print('return patient data',return_vals)
#     data = responsify(return_vals)
#     print('patient data',data)
#     return data

@app.route('/mdasi')
def get_mdasi():
    data = load_mdasi_data()
    response = responsify(data)
    return response

@app.route('/distances',methods=['GET'])
def get_distances():
    #replace this with a single file when I get that done
    with open('../data/r01_distances_small.json','r') as f:
        data = simplejson.load(f)
    # col_order = ORGAN_LIST[:]
    # data = responsify({'distances': data, 'colOrder': col_order,'rowOrder': ['gtv','gtvn']})
    return data

@app.route('/distances_full',methods=['GET'])
def get_distances_full():
    #replace this with a single file when I get that done
    with open('../data/r01_distances_full.json','r') as f:
        data = simplejson.load(f)
    col_order = ORGAN_LIST[:]
    data = responsify({'distances': data, 'colOrder': col_order,'rowOrder': ['gtv','gtvn'] + col_order})
    return data

@app.route('/pclouds',methods=['GET'])
def get_patient_clouds():
    patients = request.args.getlist('patientIds')
    if patients is None or len(patients) <= 0:
        patients = [PATIENT_IDS[0]]
    patients = [p for p in patients if int(p) in PATIENT_IDS]
    patients = get_pclouds(patients)
    data = responsify(patients)
    print('patient clouds',data)
    return data

@app.route('/images',methods=['GET'])
def get_patient_images():
    patients = request.args.getlist('patientIds')
    if patients is None or len(patients) <= 0:
        patients = [PATIENT_IDS[0]]
    patients = [p for p in patients if int(p) in PATIENT_IDS]
    patients = get_p_images(patients)
    data = responsify(patients)
    print('patient images',data)
    return data