import torch
import numpy as np
import pandas as pd
import pickle
from Preprocessing import *
from sklearn.metrics import balanced_accuracy_score, roc_auc_score,accuracy_score,precision_recall_fscore_support
# +
def get_dt_ids(df=None):
    if df is None:
        df = load_digital_twin()
    return df.id.values

def mc_loss(ytrue,ypred,weights=None):
    #this is just the multiclass loss now
    loss = torch.nn.CrossEntropyLoss(weight=weights)
    return loss(ypred,ytrue.argmax(axis=1))


# -

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

def transition_sample(state,dataset=None):
    if dataset is None:
        dataset = DTDataset()
        
    ids = get_dt_ids(dataset.processed_df.reset_index())
    
    train_ids, test_ids = get_tt_split(dataset.processed_df.reset_index())
    
    #only train on people with  IC for state 1 since other people can't have any outcomes otherwise
    require = None
    if state == 1:
        require = Const.decisions[0] #we don't expect a state update if there is no treatment
        valid_ids = dataset.get_input_state(require=require).index.values
        train_ids = [t for t in train_ids if t in valid_ids]
        test_ids = [t for t in test_ids if t in valid_ids]
    xtrain = dataset.get_input_state(step=state,ids=train_ids,require=require)
    xtest = dataset.get_input_state(step=state,ids=test_ids,require=require)
    ytrain = dataset.get_intermediate_outcomes(step=state,ids=train_ids,require=require)
    ytest = dataset.get_intermediate_outcomes(step=state,ids=test_ids,require=require)

    xtrain = df_to_torch(xtrain)
    xtest = df_to_torch(xtest)
    ytrain = [df_to_torch(t) for t in ytrain]
    ytest= [df_to_torch(t) for t in ytest]
    return xtrain,xtest,ytrain,ytest


def torch_apply_along_axis(function, x, axis: int = 0):
    return torch.stack([
        function(x_i) for x_i in torch.unbind(x, dim=axis)
    ], dim=axis)



def df_to_torch(df,ttype  = torch.FloatTensor):
    values = df.values.astype(float)
    values = torch.from_numpy(values)
    return values.type(ttype)

# +
def load_models():
    files = [
        '../resources/decision_model.pt',
        '../resources/transition1_model.pt',
        '../resources/transition2_model.pt',
        '../resources/outcome_model.pt',
        '../resources/outcomeDSM.pt',
    ]
    return  [torch.load(file) for file in files]


def load_transition_models():
    files = [
        '../resources/transition1_model.pt',
        '../resources/transition2_model.pt',
        '../resources/outcome_model.pt',
         '../resources/outcomeDSM.pt'
    ]
    return  [torch.load(file) for file in files]


# +
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

def get_weights(df_list,scale  = None,to_torch=True):
    getw = lambda df: df.shape[0]/(df.shape[1]*df.sum(axis=0)).values
    w = [getw(df) for df in df_list]

    if scale is not None:
        w = [scale(ww) for ww in w]
    if to_torch:
        return [torch.FloatTensor(ww) for ww in w]
    return w


# +
def mc_metrics(yt,yp,numpy=False,is_dlt=False,is_squeezed=False):
    if not numpy:
        yt = yt.cpu().detach().numpy()
        yp = yp.cpu().detach().numpy()
    #dlt prediction (binary)
    if is_dlt:
        acc = accuracy_score(yt,yp>.5)
        if yt.sum() > 1:
            auc = roc_auc_score(yt,yp)
        else:
            auc=-1
        error = np.mean((yt-yp)**2)
        return {'accuracy': acc, 'mse': error, 'auc': auc}
    #this is a catch for when I se the dlt prediction format (encoded integer ordinal, predict as a categorical and take the argmax)
    elif yt.ndim > 1 or is_squeezed:
        try:
            bacc = balanced_accuracy_score(yt.argmax(axis=1),yp.argmax(axis=1))
        except:
            bacc = -1
        try:
            roc_micro = roc_auc_score(yt,yp,average='micro')
        except:
            roc_micro=-1
        try:
            roc_macro = roc_auc_score(yt,yp,average='macro')
        except Exception as e:
            try: 
                roc_macro = roc_auc_score(yt[:,0:2],yp[:,0:2],average='macro')
            except:
                roc_macro = -1
        try:
            roc_weighted = roc_auc_score(yt,yp,average='weighted')
        except:
            try:
                roc_weighted = roc_auc_score(yt[:,0:2],yp[:,0:2],average='weighted')
            except:
                roc_weighted= -1
        return {'accuracy': bacc, 'auc_micro': roc_micro,'auc_mean': roc_macro,'auc_weighted': roc_weighted}
    #outcomes (binary)
    else:
        multiclass = yp.ndim > 1
        if multiclass:
            yp = yp.argmax(axis=1)
        try:
            if not multiclass:
                bacc = accuracy_score(yt,(yp>.5).astype(int))
            else:
                bacc = accuracy_score(yt,yp)
        except Exception as e:
            print(e,yp,yt)
            bacc = -1
        try:
            roc = roc_auc_score(yt,yp)
        except:
            roc = -1
        try:
            if not multiclass:
                pr,re,fscore,supp = precision_recall_fscore_support(yt,(yp>.5).astype(int),average='binary')
            else:
                pr,re,fscore,supp = precision_recall_fscore_support(yt,yp,average='macro')
        except Exception as e:
            print(e)
            [pr,re,fscore,supp] = [-1,-1,-1,-1]
        error = np.mean((yt-yp)**2)
        return {'accuracy': bacc, 'mse': error, 'auc': roc,'precision': pr,'recall':re,'f1':fscore}

def state_metrics(ytrue,ypred,numpy=False):
    pd_metrics = mc_metrics(ytrue[0],ypred[0],numpy=numpy)
    nd_metrics = mc_metrics(ytrue[1],ypred[1],numpy=numpy)
    mod_metrics = mc_metrics(ytrue[1],ypred[1],numpy=numpy)
    
    dlt_metrics = []
    dlt_true = ytrue[3]
    dlt_pred = ypred[3]
    ndlt = dlt_true.shape[1]
    nloss = torch.nn.NLLLoss()
    for i in range(ndlt):
        dm = mc_metrics(dlt_true[:,i],dlt_pred[:,i].view(-1),is_dlt=True)
        dlt_metrics.append(dm)
    dlt_acc =[d['accuracy'] for d in dlt_metrics]
    dlt_error = [d['mse'] for d in dlt_metrics]
    dlt_auc = [d['auc'] for d in dlt_metrics]
    
    acc_mean = np.mean([a for a in dlt_acc if a >= 0 and a < 1])
    auc_mean = np.mean([a for a in dlt_auc if a >= 0])
    results = {'pd': pd_metrics,'nd': nd_metrics,'mod': mod_metrics,
               'dlts': {'accuracy': dlt_acc,'accuracy_mean': acc_mean,'auc': dlt_auc,'auc_mean': auc_mean}
              }
    return results
def outcome_metrics(ytrue,ypred,numpy=False):
    res = {}
    for i, outcome in enumerate(Const.outcomes):
        metrics = mc_metrics(ytrue[i],ypred[:,i])
        res[outcome] = metrics
    return res

def baseline_mc_metrics(yt,yp):
    #this is a catch for when I se the dlt prediction format (encoded integer ordinal, predict as a categorical and take the argmax)
    try:
        bacc = balanced_accuracy_score(yt,np.argmax(yp,axis=1))
    except Exception as e:
        print('bacc',e)
        bacc = -1
    try:
        roc_micro = roc_auc_score(yt,yp,average='macro',multi_class='ovr')
    except Exception as e:
        print('micro',e)
        roc_micro = -1
    try:
        roc_macro = roc_auc_score(yt,yp,average='macro',multi_class='ovr')
    except Exception as e:
        print('macro',e)
        roc_macro = -1
    try:
        roc_weighted = roc_auc_score(yt,yp,average='weighted',multi_class='ovr')
    except Exception as e:
        print('weighted',e)
        roc_weighted= -1
    return {'accuracy': bacc,'auc_micro':roc_micro,'auc_mean':roc_macro,'auc_weighted':roc_weighted}
    
def boolean_metrics(yt,yp,yp_bool=None):
    if yp_bool is None:
        yp_bool = yp > .5
    precision, recall, f1, support = precision_recall_fscore_support(yt,yp_bool,pos_label=1,average='binary')
    auc = roc_auc_score(yt,yp)
    return {'auc': auc, 'f1': f1, 'precision': precision, 'recall':recall}

