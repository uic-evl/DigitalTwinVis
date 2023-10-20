import torch
import numpy as np
import pandas as pd
import pickle
from Preprocessing import *

def get_dt_ids(df=None):
    if df is None:
        df = load_digital_twin()
    return df.id.values

def get_tt_split(ids=None,use_default_split=True,use_bagging_split=False,resample_training=False,df=None):
        if ids is None:
            ids = get_dt_ids(df)
        #pre-made, stratified by decision and outcome 72:28
        if use_default_split:
            train_ids = Const.stratified_train_ids[:]
            test_ids = Const.stratified_test_ids[:]
        elif use_bagging_split:
            train_ids = np.random.choice(ids,len(ids),replace=True)
            test_ids = [i for i in ids if i not in train_ids]
        else:
            test_ids = ids[0: int(len(ids)*(1-split))]
            train_ids = [i for i in ids if i not in test_ids]

        if resample_training:
            train_ids = np.random.choice(train_ids,len(train_ids),replace=True)
            test_ids = [i for i in ids if i not in train_ids]
        return train_ids,test_ids

def df_to_torch(df,ttype  = torch.FloatTensor):
    values = df.values.astype(float)
    values = torch.from_numpy(values)
    return values.type(ttype)

def load_models():
    files = [
        '../resources/decision_model.pt',
        '../resources/transition1_model_pytorch.pt',
        '../resources/transition2_model_pytorch.pt',
        '../resources/outcome_model_pytorch.pt',
    ]
    decision_model,transition_model1,transition_model2, outcome_model = [torch.load(file) for file in files]
    return decision_model,transition_model1,transition_model2,outcome_model


def load_sklearn_transition_models():
    model_names = ['transition1_model.pickle','transition2_model.pickle','outcome_model.pickle']
    success = []
    for mname in model_names:
        try:
            name = '../resources/sklearn_models/' + mname
            with open(name,'rb') as f:
                model = pickle.load(f)
            success.append(model)
        except Exception as e:
            success.append(False)
            print(e)
    return success
