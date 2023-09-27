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

def load_models():
    files = [
        '../resources/decision_model.pt',
        '../resources/transition1_model.pt',
        '../resources/transition2_model.pt',
        '../resources/outcome_model.pt',
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
    def add_outcomes(names, array,suffix=''):
        for i,name in enumerate(names):
            outcomes[name+suffix] = array[:,i]
    for model,state in zip([m1,m2,m3],states):
        x = dataset.get_input_state(step=state+1,ids=ids)
        x = df_to_torch(x).to(model.get_device())
        yout = model(x)
        y = yout['predictions']
        y_lower = yout['5%']
        y_upper = yout['95%']
        if state < 2:
            y = [yy.cpu().detach().numpy() for yy in y]
            y_lower = [yy.cpu().detach().numpy() for yy in y_lower]
            y_upper = [yy.cpu().detach().numpy() for yy in y_upper]
        else:
            y = y.cpu().detach().numpy()
            y_lower = y_lower.cpu().detach().numpy()
            y_upper = y_upper.cpu().detach().numpy()
        if state == 0:
            for suffixes, values in zip(['','_5%','_95%'],[y,y_lower,y_upper]):
                [pds, nd, mod, dlts] = values
                add_outcomes(Const.primary_disease_states,pds,suffixes)
                add_outcomes(Const.nodal_disease_states,nd,suffixes)
                add_outcomes(Const.modifications,mod,suffixes)
                add_outcomes(Const.dlt1,dlts,suffixes)
        elif state == 1:
            for suffixes, values in zip(['','_5%','_95%'],[y,y_lower,y_upper]):
                [pd2, nd2, cc, dlts2] = values
                add_outcomes(Const.primary_disease_states2,pd2,suffixes)
                add_outcomes(Const.nodal_disease_states2,nd2,suffixes)
                add_outcomes(Const.dlt2,dlts2,suffixes)
        else:
            for suffixes, values in zip(['','_5%','_95%'],[y,y_lower,y_upper]):
                add_outcomes(Const.outcomes,values,suffixes)
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
    #set all basline transition states to 0 so my lazy way of checking for fixed values works
    for k in Const.primary_disease_states + Const.nodal_disease_states + list(Const.modification_types.values()) + list(Const.cc_types.values()):
        baselines[k] = 0
        baselines[k+' 2'] = 0
    for k,v in input_dict.items():
        baselines[k] = v
    return baselines

def dict_to_model_input(dataset,fdict,state=0,ttype=torch.FloatTensor,concat=True,zero_transition_states=True):
    fdict = format_patient(dataset,fdict)
    order = get_inputkey_order(dataset,state=state)
    inputs = [torch.tensor([fdict[k] for k in ordersubset]).type(ttype).view(1,-1) for ordersubset in order]
    
    #this is assuming the order is baseline, dlt1, dlt2, primary progression, nodal progression, cc type, dose modification
    def zeroinput(position):
        return torch.zeros(inputs[position].shape).type(ttype)
    if zero_transition_states:
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

def calculateMahalanobis(y=None, data=None, cov=None):
  
    y_mu = y - np.mean(data)
    if not cov:
        cov = np.cov(data.T)
    inv_covmat = np.linalg.inv(cov)
    left = np.dot(y_mu, inv_covmat)
    mahal = np.dot(left, y_mu.T)
    return mahal.diagonal()

def get_neighbors_and_embedding(pdata,dataset,decisionmodel,embedding_df=None,state=2,max_neighbors=10,pcas=None):
    decisionmodel.eval()
    if embedding_df is None:
        embedding_df = get_embedding_df(dataset,decisionmodel)
    embeddings = np.stack(embedding_df['embeddings_state'+str(state)].values)
    
    cat = lambda x: torch.cat(x,axis=1)
    
    inputs = dict_to_model_input(dataset,pdata,state=state,zero_transition_states=False)
    
    
    embedding = decisionmodel.get_embedding(inputs,position=state,use_saved_memory=True)[0].view(1,-1).cpu().detach().numpy()

    mDist = calculateMahalanobis(embedding,embeddings)
    dists = cdist(embedding,embeddings).ravel()
    
    max_neighbors = min(len(dists),max_neighbors)
    min_positions = np.argsort(dists)[:max_neighbors]
    neighbor_ids = dataset.processed_df.index.values[min_positions]
    min_dists = dists[min_positions]
    similarities = 1/(1+min_dists)
    # similarities /= similarities.max() #adjust for rounding errors, self sim should be the max
    if pcas is not None:
        pPca = pcas[state].transform(embedding)[0]
        return neighbor_ids, similarities,embedding[0],pPca, mDist[0]
    return neighbor_ids, similarities, embedding[0], mDist[0]

def test_mahalanobis_distances(dataset=None,decision_model=None,state=1,embedding_df=None):
    if embedding_df is None:
        embedding_df = get_embedding_df(dataset,decision_model)
    embeddings = np.stack(embedding_df['embeddings_state'+str(state)].values)
    dists =calculateMahalanobis(embeddings,embeddings) 
    return np.array(dists)


def dictify(keys,values):
    return {k:v for k,v in zip(keys,values)}

def get_neighbors_and_embeddings_from_sim(embeddings,dataset,decisionmodel,
                                         embedding_df=None,max_neighbors=100,
                                          pcas=None,
                                          pca_components=2,
                                         ):
    #this is get_embeddings_and_neighbors, but uses the optimal model from get_stuff_For_patient embeddings
    #instead of just kinda not simulation anyhting. adds 1 second on my UIC workstation to the simulation
    if embedding_df is None:
        embedding_df = get_embedding_df(dataset,decisionmodel)
    cat = lambda x: torch.cat(x,axis=1)
    
    embed_arrays = [np.stack(embedding_df['embeddings_state'+str(s)].values) for s in embeddings.keys()]
    if pcas is None:
        pcas = [PCA(pca_components,whiten=True).fit(e) for e in embed_arrays]
    i = 0
    results = {}
    for state, embedding in embeddings.items():
        embedding_array = embed_arrays[i]
        mdist = calculateMahalanobis(embedding.reshape(1,-1),embedding_array)
        
        dists = cdist(embedding,embedding_array).ravel()
        max_neighbors = min(len(dists),max_neighbors)
        min_positions = np.argsort(dists)[:max_neighbors]
        neighbor_ids = dataset.processed_df.index.values[min_positions]
        min_dists = dists[min_positions]
        similarities = 1/(1+min_dists)
        # similarities /= similarities.max() #adjust for rounding errors, self sim should be the max
        pPca = pcas[i].transform(embedding)[0]
        entry = {
            'neighbors': neighbor_ids, 
            'similarities': similarities,
            'embedding': embedding[0],
            'pca': pPca, 
            'mahalanobisDistance': mdist[0]
        }
        results[state] = entry
        i+=1
        
    return results


def get_stuff_for_patient(patient_dict,data,tmodel1,tmodel2,outcomemodel,decisionmodel,state=0,model_type='optimal',**kwargs):
    #this takes a patient dict and returns the results for a full treatment simulation
    #currently if state > 0 it will check if prior transition states are all zero and if not, will input them
    #currently works with categorical, might have to experiment with passing like -1 for fixed "no" with fixed no dlts
    pdata = format_patient(data,patient_dict)
    baseline_inputs = dict_to_model_input(data,pdata,state=0,concat=False) 
    
    
    
    tmodel1.eval()
    tmodel2.eval()
    outcomemodel.eval()
    decisionmodel.eval()
    device = 'cpu'
    if torch.cuda.is_available():
        device='cuda'
    tmodel1.set_device(device)
    tmodel2.set_device(device)
    outcomemodel.set_device(device)
    decisionmodel.set_device(device)
    results = {}
    embeddings = {}
    #do a loop for imitation and a loop for optimal decision making, mod = 3 is imitation
    format_transition = lambda x: x.view(1,-1).to(device)
    #inputs are order baseline, dlt1, dlt2, pd, nd, cc type, dose modifications
    #model output is nx6 -> optimal 1 , 2, 3, imitation 1, 2, 3
    cat = lambda x: torch.cat([xx.to(device) for xx in x],axis=1).to(device)
    
    size_dict = decisionmodel.input_sizes
    
    #baseline, dlt1, dlt2, pd, nd, cc, mod
    input_keys = get_inputkey_order(data)
    def get_attention(xx, position, offset):
        attention = decisionmodel.get_attributions(xx,target=position+offset, position=1)[0].cpu().detach().numpy()
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
    memory = cat([df_to_torch(f) for f in memory])
    o1 = decisionmodel(cat(baseline_inputs),position=0)[0]
    
    thresh = lambda x: torch.gt(x,.5).type(torch.FloatTensor)
    
    modifiers = [3] if model_type == 'imitation' else [0]
    if model_type == 'both':
        modifiers = [0,3]
        
    def get_fixed_transitions():
        
        [base, dlt1,_,pd1,nd1,_,mod] =dict_to_model_input(data,pdata,state=1,
                                                          concat=False,zero_transition_states=False)
        [base, _,dlt2,pd2,nd2,cc,_] =dict_to_model_input(data,pdata,state=2,
                                                          concat=False,zero_transition_states=False)
        isfixed = lambda d: not (torch.sum(d) < .00001)
        results = {
            'dlt1': isfixed(dlt1),
            'dlt2': isfixed(dlt2),
            'pd1': isfixed(pd1),
            'pd2': isfixed(pd2),
            'nd1': isfixed(nd2),
            'nd2': isfixed(nd2),
            'cc': isfixed(cc),
            'mod': isfixed(mod)
        }
        return results
    fixed_transitions = get_fixed_transitions()
    print('fixed_decisions',fixed_transitions)
    def run_simulation(modifier,decision1=None,decision2=None,decision3=None):
        #do this to track malahanobis distances?
        is_default = (modifier == modifiers[0] and decision1 is None and decision2 is None and decision3 is None)
        if is_default:
            embeddings[0] = decisionmodel.get_embedding(cat(baseline_inputs),position=0,use_saved_memory=True)
            
        #transition 1 model uses usebaline + decision
        if decision1 is not None:
            d1 = torch.tensor([[decision1]]).type(torch.FloatTensor)
            d1_attention=0
        else:
            d1 = o1[0+modifier].view(1,-1)
            d1_attention = get_attention(cat(baseline_inputs),0,modifier)
        tinput1 = cat([baseline_inputs[0],thresh(d1)])
        
        ytransition = tmodel1(tinput1)
        [ypd1,ynd1,ymod,ydlt1] = ytransition['predictions']

        [ypd1, ynd1, ymod] = [format_transition(i) for i in [ypd1,ynd1,ymod]]
        
        #I try to make this work in the model but it just thinks there's no outcome and softmaxes them all often
        d1_thresh = torch.gt(d1,.5).view(-1,1).to(device)
        ypd1[:,0:2] = ypd1[:,0:2]*d1_thresh
        ynd1[:,0:2] = ynd1[:,0:2]*d1_thresh
        
        oinput2 = dict_to_model_input(data,pdata,state=1,concat=False,zero_transition_states=False)
        #if the input stuff has a value for transition states and state passed is > 0, fix them
        
        #check if I should actually use the transition states
        if state > 0 and fixed_transitions['dlt1']:
            ydlt1 = torch.clone(oinput2[1])
        else:
            oinput2[1] = ydlt1.view(1,-1)
        if state > 0 and fixed_transitions['pd1']:
            ypd1 = torch.clone(oinput2[3])
        else:
            oinput2[3] = ypd1
        if state > 0 and fixed_transitions['nd1']:
            ynd1 = torch.clone(oinput2[4])
        else:
            oinput2[4] = ynd1
        if state > 0 and fixed_transitions['mod']:
            ymod = torch.clone(oinput2[6])
        else:
            oinput2[6] = torch.clone(ymod)
            
            
        if decision2 is not None:
            d2 = torch.tensor([[decision2]]).type(torch.FloatTensor)
            d2_attention=0
        else:
            d2 = decisionmodel(cat(oinput2),position=1)[0,1+modifier].view(1,-1)
            d2_attention = get_attention(cat(oinput2),1,modifier)
        if is_default:
            embeddings[1] = decisionmodel.get_embedding(cat(oinput2),position=1,use_saved_memory=True)
            
        #transition 2 modle uses baseline + pd1 + nd1 + modification + dlt1 + decision 1 + deicsion 2
        tinput2 = [baseline_inputs[0], ypd1, ynd1, ymod,ydlt1, thresh(d1),thresh(d2)]

        tinput2 = cat(tinput2)
        
        ytransition2 = tmodel2(tinput2)
        [ypd2, ynd2, ycc, ydlt2] = ytransition2['predictions']
        [ypd2, ynd2, ycc] = [format_transition(i) for i in [ypd2,ynd2,ycc]]
        
        oinput3 = oinput2[:]
        #check if I should use the transition states again
        if state > 1 and fixed_transitions['dlt2']:
            ydlt2 = torch.clone(oinput3[2])
        else:
            oinput3[2] = ydlt2.view(1,-1)
        if state > 1 and fixed_transitions['pd2']:
            ypd2 = torch.clone(oinput3[3])
        else:
            oinput3[3] = ypd2
        if state > 1 and fixed_transitions['nd2']:
            ynd2 = torch.clone(oinput3[4])
        else:
            oinput3[4] = ynd2
        if state > 1 and fixed_transitions['cc']:
            ycc = torch.clone(oinput3[5])
        else:
            oinput3[5] = torch.clone(ycc)

            
        if decision3 is not None:
            d3 = torch.tensor([[decision3]]).type(torch.FloatTensor)
            d3_attention=0
        else:
            d3 = decisionmodel(cat(oinput3),position = 2)[0,2+modifier].view(1,-1)
            d3_attention = get_attention(cat(oinput3),2,modifier)
        if is_default:
            embeddings[2] =decisionmodel.get_embedding(cat(oinput3),position=2,use_saved_memory=True)
        #outcomes uses baseline + pd2 + nd2 + cc type + dlt2 + decision 1,2,3
        tinput3 = [baseline_inputs[0], ypd2, ynd2, ycc, ydlt2, thresh(d1), thresh(d2), thresh(d3)]
        tinput3 = cat(tinput3)
        outcomes = outcomemodel(tinput3)
        
        entry = {
            'decision1': d1.cpu().detach().numpy()[0][0],
            'decision2': d2.cpu().detach().numpy()[0][0],
            'decision3': d3.cpu().detach().numpy()[0][0],
            'decision1_attention': d1_attention,
            'decision2_attention': d2_attention,
            'decision3_attention': d3_attention,
        }
        def add_to_entry(tmodel_output,names):
            pred = tmodel_output['predictions']
            lower = tmodel_output['5%']
            upper = tmodel_output['95%']
            for suffix,values in zip(['','_5%','_95%'],[pred,lower,upper]):
                for name, v in zip(names,values):
                    v = v.cpu().detach().numpy()
                    if name != 'outcomes':
                        v = v[0]
                    #because of softmax the model will output 33% for pd and nd with no ic when it should be fixed to 0
                    if entry['decision1'] < .5 and ('pd1' in name or 'nd1' in name):
                        v = np.zeros(v.shape)
                    entry[name+suffix] = v
        add_to_entry(ytransition,['pd1','nd1','modifications','dlt1'])
        add_to_entry(ytransition2,['pd2','nd2','cc_type','dlt2'])
        add_to_entry(outcomes,['outcomes'])
        key = 'optimal' if modifier < 1 else 'imitation'
        if decision1 is not None:
            key += '_decision1-'+str(decision1)
        if decision2 is not None:
            key += '_decision2-'+str(decision2)
        if decision3 is not None:
            key += '_decision3-'+str(decision3)
        results[key] = entry

    
    with torch.no_grad():
        for modifier in modifiers:
            for d1_fixed in [None,0,1]:
                for d2_fixed in [None,0,1]:
                    for d3_fixed in [None,0,1]:
                        #we only need to do all fixed outcomes once
                        if d1_fixed is not None and d2_fixed is not None and d3_fixed is not None and modifier != modifiers[0]:
                            continue
                        run_simulation(modifier,d1_fixed,d2_fixed,d3_fixed)
    for k,v in embeddings.items():
        embeddings[k] = v.cpu().detach().numpy()
    embedding_results = get_neighbors_and_embeddings_from_sim(embeddings,data,decisionmodel,**kwargs)
    return {'simulation': results,'embeddings': embedding_results}