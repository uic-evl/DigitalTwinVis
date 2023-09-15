import torch
import numpy as np
import pandas as pd
from Preprocessing import *

def get_dt_ids():
    df = load_digital_twin()
    return df.id.values

def get_tt_split(ids=None,use_default_split=True,use_bagging_split=False,resample_training=False):
        if ids is None:
            ids = get_dt_ids()
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
        '../resources/transition1_model.pt',
        '../resources/transition2_model.pt',
        '../resources/outcome_model.pt',
    ]
    decision_model,transition_model1,transition_model2, outcome_model = [torch.load(file) for file in files]
    return decision_model,transition_model1,transition_model2,outcome_model