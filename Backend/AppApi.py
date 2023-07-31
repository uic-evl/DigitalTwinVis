import simplejson
import numpy as np
import pandas as pd
import datetime
import re
import torch
from Preprocessing import DTDataset
from sklearn.decomposition import PCA
from scipy.spatial.distance import cdist
from Constants import Const

def load_dataset():
    data = DTDataset()
    newdf = data.processed_df.copy()
    for c in newdf.columns:
        if newdf[c].dtype == np.float64:
            newdf[c] = newdf[c].astype(np.float32).apply(lambda x: np.round(x,2))
    data.processed_df = newdf
    return data

def load_models(use_upsampled=True):
    files = [
        '../resources/decision_model.pt',
        '../resources/transition1_model.pt',
        '../resources/transition2_model.pt',
        '../resources/outcome_model_smote.pt',
    ]
    if use_upsampled:
        files = [
            '../resources/decision_model_smote.pt',
            '../resources/transition1_model_smote.pt',
            '../resources/transition2_model_smote.pt',
            '../resources/outcome_model_smote.pt',
        ]
    decision_model,transition_model1,transition_model2, outcome_model = [torch.load(file) for file in files]
    return decision_model,transition_model1,transition_model2,outcome_model


def np_converter(obj):
    #converts stuff to vanilla python  for json since it gives an error with np.int64 and arrays
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.float32):
        return np.round(float(obj),8)
    elif isinstance(obj, float):
        return round(float(obj),8)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, datetime.datetime) or isinstance(obj, datetime.time):
        return obj.__str__()
    print('np_converter cant encode obj of type', obj,type(obj))
    return obj

def get_default_predictions(dm):
    res  = []
    for state in [0,1,2]:
        mem = dm.memory[state]
        mem = torch.median(mem,dim=0)[0].type(torch.FloatTensor)
        val = dm(mem.reshape(1,-1),position=state)
        res.append(val.cpu().detach().numpy())
    return np.vstack(res)

def get_default_prediction_json(dm):
    vals = get_default_predictions(dm)
    res={}
    for i,model in enumerate(['optimal','imitation']):
        entry = {}
        for state,decision in enumerate(Const.decisions):
            val = vals[state, state + (3*i)]
            entry[decision] = val
        res[model] = entry
    return res

def jsonify_np_dict(d):
    return simplejson.dumps(d,default=np_converter)


def get_dataset_jsons(dataset,ids=None,fields=None):
    df = dataset.processed_df.copy()
    print(ids,fields)
    if ids is not None and len(ids) > 0:
        df = df.loc[ids]
    if fields is not None and len(fields) > 0:
        df = df[fields]
    pdict = df.to_dict(orient='index')
    return jsonify_np_dict(pdict)

def get_embedding_json(dataset,decisionmodel,embed_df = None,precision=4,ids=None,fields=None):
    if embed_df is None:
        embed_df = get_embedding_df(dataset,decisionmodel)
    else:
        embed_df=embed_df.copy()
    if ids is not None and len(ids) > 0:
        embed_df = embed_df.loc[ids]
        
    for c in embed_df.columns:
        if 'embed' in c:
            embed_df[c] = embed_df[c].apply(lambda x: [round(float(xx),precision) for xx in x.astype(float)])
    to_keep = [c for c in embed_df if 'input' not in c]
    if fields is not None and len(fields) > 0:
        to_keep = [k for k in to_keep if k in fields]
    
    edict = embed_df[to_keep].to_dict(orient='index')
    return jsonify_np_dict(edict)

def df_to_torch(df,ttype  = torch.FloatTensor):
    values = df.values.astype(float)
    values = torch.from_numpy(values)
    return values.type(ttype)

def get_decision_input(dataset,state=0,ids=None):
    baseline = dataset.get_state('baseline')
    dlt1 = dataset.get_state('dlt1')
    dlt2 = dataset.get_state('dlt2')
    pd1 = dataset.get_state('pd_states1')
    pd2 = dataset.get_state('pd_states2')
    nd1 = dataset.get_state('nd_states1')
    nd2 = dataset.get_state('nd_states2')
    modifications = dataset.get_state('modifications')
    ccs = dataset.get_state('ccs')
    if state < 2:
        pd = pd1.copy()
        nd = nd1.copy()
        dlt2.values[:,:] = np.zeros(dlt2.shape)
        ccs.values[:,:] = np.zeros(ccs.shape)
        if state < 1:
            dlt1.values[:,:] = np.zeros(dlt1.shape)
            modifications.values[:,:] = np.zeros(modifications.shape)
            pd.values[:,:] = np.zeros(pd.shape)
            nd.values[:,:] = np.zeros(nd.shape)
    else:
        pd = pd2.copy()
        nd = nd2.copy()
        
    output = [baseline, dlt1, dlt2, pd, nd,ccs,modifications]
    if ids is not None:
        output = [o.loc[ids] for o in output]
    return output

def get_inputkey_order(dataset,state=0):
    return [list(f.columns) for f in get_decision_input(dataset,state=state)]

def get_predictions(dataset,m1,m2,m3,states=[0,1,2],ids=None):
    outcomes = {}
    def add_outcomes(names, array):
        for i,name in enumerate(names):
            outcomes[name] = array[:,i]
            
    for model,state in zip([m1,m2,m3],states):
        x = dataset.get_input_state(step=state+1,ids=ids)
        x = df_to_torch(x)
        y = model(x)
        if state < 2:
            y = [yy.cpu().detach().numpy() for yy in y]
        else:
            y = y.cpu().detach().numpy()
        if state == 0:
            [pds, nd, mod, dlts] = y
            add_outcomes(Const.primary_disease_states,np.exp(pds))
            add_outcomes(Const.nodal_disease_states,np.exp(nd))
            add_outcomes(Const.modifications,np.exp(mod))
            add_outcomes(Const.dlt1,dlts)
        elif state == 1:
            [pd2, nd2, cc, dlts2] = y
            add_outcomes(Const.primary_disease_states2,np.exp(pd2))
            add_outcomes(Const.nodal_disease_states2,np.exp(nd2))
            add_outcomes(Const.dlt2,dlts2)
        else:
            add_outcomes(Const.outcomes,y)
    if ids is None:
        ids = dataset.processed_df.index.values
    outcomes = pd.DataFrame(outcomes,ids)
    outcomes.index.name = 'id'
    return outcomes

def get_embeddings(dataset,dm,states=[0,1,2],use_saved_memory=True,decimals=2):
    embeddings = []
    inputs = []
    decisions_optimal = [[] for i in states]
    decisions_imitation = [[] for i in states]
    for i,state in enumerate(states):
        x = get_decision_input(dataset,state=state)
        x = torch.cat([df_to_torch(f) for f in x],axis=1)
        embedding = dm.get_embedding(x,position = state,use_saved_memory=use_saved_memory)
        inputs.append(x.detach().numpy())
        decision = dm(x,position=state).cpu().detach().numpy()
        decisions_optimal[i].append(decision[:,state])
        decisions_imitation[i].append(decision[:,state+3])
        embedding = embedding.cpu().detach().numpy()
        if decimals is not None:
            embedding = np.round(embedding,decimals)
        embeddings.append(embedding)
    return embeddings,np.array(decisions_optimal).reshape(len(states),-1).T, np.array(decisions_imitation).reshape(len(states),-1).T, inputs

def get_embedding_pcas(dataset,decision_model,embeddings=None,components=2):
    if embeddings is None:
        embeddings, _, _, _ = get_embeddings(dataset,decision_model,states=[0,1,2])
    pcas = [PCA(components,whiten=True).fit(e) for e in embeddings]
    return pcas

def get_embedding_df(dataset,dm,states=[0,1,2],pcas=None,**kwargs):
    embeddings, decisions_opt, decisions_im, embedding_inputs = get_embeddings(dataset,dm,
                                                                                      states=states,**kwargs)
    values = {'embeddings_state'+str(i): [np.array(ee) for ee in e] for i,e in zip(states,embeddings)}
    newdf = pd.DataFrame(values,index=dataset.processed_df.index.values)
    for ii in states:
        opt = decisions_opt[:,ii]
        im = decisions_im[:,ii]
        newdf['decision'+str(ii)+"_optimal"] = opt
        newdf['decision'+str(ii)+'_imitation'] = im
        newdf['inputs'+str(ii)] = [np.array(ee) for ee in embedding_inputs[ii]]
    
    if pcas is None:
        pcas = get_embedding_pcas(dataset,dm,embeddings=embeddings)
    reductions = [ipca.fit_transform(e) for ipca,e in zip(pcas,embeddings)]
    for state,r in enumerate(reductions):
        newdf['pca_state'+str(state)] = [np.array(rr) for rr in r]
    return newdf

def get_default_input(dataset,state=0,ids=None):
    output = get_decision_input(dataset,state=state,ids=ids)
    output = [o.median().to_dict() for o in output]
    return output

def format_patient(dataset,input_dict):
    #converts patient input features into data input type
    baselines = dataset.processed_df.median().to_dict()
    for k,v in input_dict.items():
        baselines[k] = v
    return baselines

def dict_to_model_input(dataset,fdict,state=0,ttype=torch.FloatTensor,concat=True):
    fdict = format_patient(dataset,fdict)
    order = get_inputkey_order(dataset,state=state)
    inputs = [torch.tensor([fdict[k] for k in ordersubset]).type(ttype).view(1,-1) for ordersubset in order]
    
    #this is assuming the order is baseline, dlt1, dlt2, primary progression, nodal progression, cc type, dose modification
    def zeroinput(position):
        return torch.zeros(inputs[position].shape).type(ttype)
    if state == 0 or state == 1:
        inputs[2] = zeroinput(2)
        inputs[5] = zeroinput(5)
    if state < 1:
        inputs[1] = zeroinput(1)
        inputs[3] = zeroinput(3)
        inputs[4] = zeroinput(4)
        inputs[6] =zeroinput(6)
    if concat:
        inputs = torch.cat(inputs,axis=1)
    #currently at this line its baseline, dlt1, dlt2, pd, nd, cc, modifications
    return inputs

def get_neighbors_and_embedding(pdata,dataset,decisionmodel,embedding_df=None,state=2,max_neighbors=10,pcas=None):
    decisionmodel.eval()
    if embedding_df is None:
        embedding_df = get_embedding_df(dataset,decisionmodel)
    embeddings = np.stack(embedding_df['embeddings_state'+str(state)].values)
    
    cat = lambda x: torch.cat(x,axis=1)
    
    inputs = dict_to_model_input(dataset,pdata,state=state)
    
    
    embedding = decisionmodel.get_embedding(inputs,position=state,use_saved_memory=True)[0].view(1,-1).detach().numpy()

    dists = cdist(embedding,embeddings).ravel()
    
    max_neighbors = min(len(dists),max_neighbors)
    min_positions = np.argsort(dists)[:max_neighbors]
    neighbor_ids = dataset.processed_df.index.values[min_positions]
    min_dists = dists[min_positions]
    similarities = 1/(1+min_dists)
    # similarities /= similarities.max() #adjust for rounding errors, self sim should be the max
    if pcas is not None:
        pPca = pcas[state].transform(embedding)[0]
        return neighbor_ids, similarities,embedding[0],pPca
    return neighbor_ids, similarities, embedding[0]

def dictify(keys,values):
    return {k:v for k,v in zip(keys,values)}

def get_stuff_for_patient(patient_dict,data,tmodel1,tmodel2,outcomemodel,decisionmodel):
    #this takes a patient dict and returns the results for a full treatment simulation
    #currently this is only the baseline and I need to think more about what to do with fixed values?
    pdata = format_patient(data,patient_dict)
    baseline_inputs = dict_to_model_input(data,pdata,state=0,concat=False) 
    #inputs are order baseline, dlt1, dlt2, pd, nd, cc type, dose modifications
    #model output is nx6 -> optimal 1 , 2, 3, imitation 1, 2, 3
    cat = lambda x: torch.cat(x,axis=1)
    
    
    #do a loop for imitation and a loop for optimal decision making, mod = 3 is imitation
    format_transition = lambda x: torch.exp(x.view(1,-1))
    tmodel1.eval()
    tmodel2.eval()
    outcomemodel.eval()
    decisionmodel.eval()
    results = {}
    
    size_dict = decisionmodel.input_sizes
    
    #baseline, dlt1, dlt2, pd, nd, cc, mod
    input_keys = get_inputkey_order(data)
    def get_attention(xx, position, offset):
        attention = decisionmodel.get_attributions(xx,target=position+offset, position=1)[0].detach().numpy()
        attention_dict = {
            'step': position,
            'model': 'optimal' if offset == 0 else 'imitation',
            'range': [float(attention.min()),float(attention.max())],
            'baseline': dictify(input_keys[0],attention[0:size_dict['baseline']]),
        }
        pos = size_dict['baseline']
        attention_dict['dlt1'] = dictify(input_keys[1],attention[pos:pos+size_dict['dlt']])
        pos += size_dict['dlt']
        attention_dict['dlt2'] = dictify(input_keys[2], attention[pos:pos+size_dict['dlt']])
        pos += size_dict['dlt']
        attention_dict['pd'] = dictify(input_keys[3], attention[pos:pos+size_dict['pd']])
        pos += size_dict['pd']
        attention_dict['nd'] = dictify(input_keys[4], attention[pos:pos+size_dict['nd']])
        pos += size_dict['nd']
        attention_dict['cc'] = dictify(input_keys[5], attention[pos:pos+size_dict['cc']])
        pos += size_dict['cc']
        attention_dict['modifications'] = dictify(input_keys[6], attention[pos:])
        return attention_dict
        
    memory = get_decision_input(data,state=2)
    memory = torch.cat([df_to_torch(f) for f in memory],axis=1)
    o1 = decisionmodel(cat(baseline_inputs),position=0)[0]
    
    thresh = lambda x: torch.gt(x,.5).type(torch.FloatTensor)
    def run_simulation(modifier,decision1=None,decision2=None,decision3=None):
        #transition 1 model uses usebaline + decision
        if decision1 is not None:
            d1 = torch.tensor([[decision1]]).type(torch.FloatTensor)
            d1_attention=0
        else:
            d1 = o1[0+modifier].view(1,-1)
            d1_attention = get_attention(cat(baseline_inputs),0,modifier)
        tinput1 = torch.cat([baseline_inputs[0],thresh(d1)],axis=1)
        [ypd1,ynd1,ymod,ydlt1] = tmodel1(tinput1)
        [ypd1, ynd1, ymod] = [format_transition(i) for i in [ypd1,ynd1,ymod]]
        #I try to make this work in the model but it just thinks there's no outcome and softmaxes them all often
        d1_thresh = torch.gt(d1,.5).view(-1,1)
        ypd1[:,:] = ypd1[:,:]*d1_thresh
        ynd1[:,:] = ynd1[:,:]*d1_thresh
        
        oinput2 = dict_to_model_input(data,pdata,state=1,concat=False)
        oinput2[1] = ydlt1.view(1,-1)
        oinput2[3] = ypd1
        oinput2[4] = ynd1
        oinput2[6] = ymod
        
        if decision2 is not None:
            d2 = torch.tensor([[decision2]]).type(torch.FloatTensor)
            d2_attention=0
        else:
            d2 = decisionmodel(cat(oinput2),position=1)[0,1+modifier].view(1,-1)
            d2_attention = get_attention(cat(oinput2),1,modifier)
        
        #transition 2 modle uses baseline + pd1 + nd1 + modification + dlt1 + decision 1 + deicsion 2
        tinput2 = [baseline_inputs[0], ypd1, ynd1, ymod,ydlt1, thresh(d1),thresh(d2)]

        tinput2 = torch.cat(tinput2,axis=1)
        [ypd2, ynd2, ycc, ydlt2] = tmodel2(tinput2)
        [ypd2, ynd2, ycc] = [format_transition(i) for i in [ypd2,ynd2,ycc]]
        
        oinput3 = oinput2[:]
        oinput3[2] = ydlt2.view(1,-1)
        oinput3[3] = ypd2
        oinput3[4] = ynd2
        oinput3[5] = ycc
        
        if decision3 is not None:
            d3 = torch.tensor([[decision3]]).type(torch.FloatTensor)
            d3_attention=0
        else:
            d3 = decisionmodel(cat(oinput3),position = 2)[0,2+modifier].view(1,-1)
            d3_attention = get_attention(cat(oinput3),2,modifier)
        
        #outcomes uses baseline + pd2 + nd2 + cc type + dlt2 + decision 1,2,3
        tinput3 = [baseline_inputs[0], ypd2, ynd2, ycc, ydlt2, thresh(d1), thresh(d2), thresh(d3)]
        tinput3 = torch.cat(tinput3,axis=1)
        outcomes = outcomemodel(tinput3)
        
        entry = {
            'outcomes': outcomes.detach().numpy()[0],
            'pd1': ypd1.detach().numpy()[0],
            'nd1': ynd1.detach().numpy()[0],
            'pd2': ypd2.detach().numpy()[0],
            'nd2': ynd2.detach().numpy()[0],
            'modifications': ymod.detach().numpy()[0],
            'cc_type': ycc.detach().numpy()[0],
            'dlt1': ydlt1.detach().numpy()[0],
            'dlt2': ydlt2.detach().numpy()[0],
            'decision1': d1.detach().numpy()[0][0],
            'decision2': d2.detach().numpy()[0][0],
            'decision3': d3.detach().numpy()[0][0],
            'decision1_attention': d1_attention,
            'decision2_attention': d2_attention,
            'decision3_attention': d3_attention,
        }
        key = 'optimal' if modifier < 1 else 'imitation'
        if decision1 is not None:
            key += '_decision1-'+str(decision1)
        if decision2 is not None:
            key += '_decision2-'+str(decision2)
        if decision3 is not None:
            key += '_decision3-'+str(decision3)
        results[key] = entry
    with torch.no_grad():
        for modifier in [0,3]:
            for d1_fixed in [None,0,1]:
                for d2_fixed in [None,0,1]:
                    for d3_fixed in [None,0,1]:
                        #we only need to do all fixed outcomes once
                        if d1_fixed is not None and d2_fixed is not None and d3_fixed is not None and modifier > 0:
                            continue
                        run_simulation(modifier,d1_fixed,d2_fixed,d3_fixed)
    return results