import pickle
import simplejson
import numpy as np
import datetime
import glob

DICOM_DIR = '../data/DICOMS/ProcessedPatients/';
ORGAN_LIST = [
        'hyoid',
        'mandible',
        'brachial_plex_l','brachial_plex_r',
        'brainstem',
        'oral_cavity',
        'glottis',
        'thyroid',
        'cricoid',
        'cricopharyngeal_muscle',
        'esophagus',
        'glnd_submand_l','glnd_submand_r',
        'genioglossus_m',
        'glottis',
        'hard_palate','soft_palate',
        'ipc','spc','mpc',
        'parotid_l','parotid_r',
        'larynx',
        'supraglottic_larynx',
        'lips_lower','lips_upper',
        'ant_digastric_l','ant_digastric_r',
        'mastoid_l','mastoid_r',
        'medial_pterygoid_l','medial_pterygoid_r',
        'lateral_pterygoid_l','lateral_pterygoid_r',
        'buccinator_l','buccinator_r',
        'masseter_l','masseter_r',
        'post_digastric_l','post_digastric_r',
        'sternocleidomastoid_l','sternocleidomastoid_r',
        'spinal_cord',
        'tongue',
        'pituitary',
    ]

def jsonify_np_dict(d):
    def numpy_converter(obj):
        #converts stuff to vanilla python  for json since it gives an error with np.int64 and arrays
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, float):
            return round(float(obj),3)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, datetime.datetime):
            return obj.__str__()
        return obj
    return simplejson.dumps(d,default=numpy_converter)

def np_converter(obj):
    #converts stuff to vanilla python  for json since it gives an error with np.int64 and arrays
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, float):
        return round(float(obj),3)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, datetime.datetime) or isinstance(obj, datetime.time):
        return obj.__str__()
    print('np_converter cant encode obj of type', obj,type(obj))
    return obj
    
def np_dict_to_json(d,destination_file, nan_to_null = False):   
    try:
        with open(destination_file, 'w') as f:
            #nan_to_null makes it save it as null in the json instead of NaN
            #more useful when it's sent to a json but will be read back in python as None
            simplejson.dump(d,f,default = np_converter, ignore_nan = nan_to_null)
        return True
    except Exception as e:
        print(e)
        return False

def load_dicom_data():
    file = '../data/processed_dicoms.p'
    with open(file,'rb') as f:
        patient_list = pickle.load(f)
    return patient_list

def load_mdasi_data():
    file = '../data/dicom_mdasi.json'
    with open(file,'r') as f:
        data = simplejson.load(f)
    return data

def get_all_pids():
    files = glob.glob(DICOM_DIR + 'pclouds_*.json')
    pids = []
    for file in files:
        pid = file.replace('\\','/').replace(DICOM_DIR,'').replace('pclouds_','').replace('\\','').replace('/','').replace('.json','')
        if pid.isnumeric():
            pids.append(int(pid))
        else:
            print('bad pid',pid)
    return pids

def get_patient_pcloud(pid):
    try:
        file = DICOM_DIR + 'pclouds_' + str(int(pid)) + '.json'
        with open(file,'r') as f:
            pcloud = simplejson.load(f)
        pcloud['contours'] = {k: pcloud['contours'][k] for k in pcloud['contour_pointclouds'].keys()}
        return pcloud
    except:
        return
    
def get_patient_parameters():
    rois = ORGAN_LIST[:] + ['gtv','gtvn','ctv','ptv']
    distance_row_order = ['gtv','gtvn']
    distance_col_order = ORGAN_LIST[:]
    return {'rois': rois, 'distance_row_order': distance_row_order,'distance_col_order': distance_col_order}


def get_patient_dosecloud(pid):
    file = DICOM_DIR + 'contours_' + str(int(pid)) + '.json'
    try:
        with open(file,'r') as f:
            pdict = simplejson.load(f)
        return pdict
    except:
        return

def get_pclouds(pid_list):
    pclouds = [get_patient_pcloud(pid) for pid in pid_list]
    pclouds = [p for p in pclouds if p is not None]
    return pclouds

def get_p_contours(pid_list):
    pdicts = [get_patient_contours(pid) for pid in pid_list]
    pdicts = [p for p in pdicts if p is not None]
    return pdicts