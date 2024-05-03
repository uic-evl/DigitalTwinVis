import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import re
from sklearn.metrics import balanced_accuracy_score, roc_auc_score,accuracy_score,precision_recall_fscore_support, f1_score, matthews_corrcoef
from Constants import *
from Preprocessing import *
from Models import *
import copy
from Utils import *
from Misc import *
from DeepSurvivalModels import *

transition_model_files = ['transitionmodel_temp, transtionmodel2_temp, outcomemodel_temp']
dsm_model_file = 'dsm_model_temp'
policy_model_file = 'decisionmodel_temp'

def state_loss(ytrue,ypred,subweights=None,weights=None):
    if weights is None:
        weights = [1,1,1,1]
    if subweights is None:
        subweights = [None,None,None]
    pd_loss = torch.mul(mc_loss(ytrue[0],ypred[0],weights=subweights[0]),weights[0])
    nd_loss = torch.mul(mc_loss(ytrue[1],ypred[1],weights=subweights[1]),weights[1])
    mod_loss = torch.mul(mc_loss(ytrue[2],ypred[2],weights=subweights[2]),weights[2])
    loss = torch.add(pd_loss,torch.add(nd_loss,mod_loss))
    dlt_true = ytrue[3]
    dlt_pred = ypred[3]
    ndlt = dlt_true.shape[1]
#     nloss = torch.nn.NLLLoss()
    bce = torch.nn.BCELoss()
    for i in range(ndlt):
        dlt_loss = bce(dlt_pred[:,i].view(-1),dlt_true[:,i].view(-1))
        dlt_loss = torch.mul(dlt_loss,weights[3]/ndlt)
        loss = torch.add(loss,dlt_loss)
    return loss

def outcome_loss(ytrue,ypred,weights=None,**kwargs):
    if weights is None:
        weights = [1,1,1,1]
    loss = 0
    nloss = torch.nn.BCELoss()
    for i in range(len(weights)):
        iloss = nloss(ypred[:,i],ytrue[i])*weights[i]
        loss += iloss
    return loss

def train_state(model=None,
                model_args={},
                state=1,
                split=.7,
                lr=.001,
                epochs=1000,
                patience=10,
                weights=None,
                save_path='../data/models/',
                use_default_split=True,
                use_bagging_split=False,
                resample_training=False,#use bootstraping on training data after splitting
                n_validation_trainsteps=2,
                verbose=True,
                balanced=True,
                sqrt_balance_weights=False,
                use_smote=False,
                smote_cols = None,
                file_suffix=''):
    
    ids = get_dt_ids()
    
    train_ids, test_ids = get_tt_split(use_default_split=use_default_split,use_bagging_split=use_bagging_split,resample_training=resample_training)

    if use_smote:
        if smote_cols is None:
            smote_cols = Const.outcomes
            if state == 1:
                smote_cols = Const.primary_disease_states
            elif state == 2:
                smote_cols = Const.primary_disease_states2
        dataset = DTDataset(use_smote=True,smote_ids = train_ids,smote_columns=[Const.decisions[state-1]])
        train_ids = [i for i in dataset.processed_df.index.values if i not in test_ids]
    else:
        dataset = DTDataset()
    
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
    
    model_args = {k:v for k,v in model_args.items() if 'attention' not in k and 'embed_size' not in k}
    if state < 3:
        if model is None:
                model = BayesianOutcomeSimulator(xtrain.shape[1],state=state,**model_args)
        lfunc = state_loss
        if weights is None:
            weights = [1,1,.1,1]
    else:
        if model is None:
                model = BayesianEndpointSimulator(xtrain.shape[1],**model_args)
        if weights is None:
            weights = [1,1,1,1]
        lfunc = outcome_loss
    print(model.passthrough)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model.set_device(device)
    
    balance_weights=None
    if balanced:
        if state < 3:
            balance_weights = [w.to(device) for w in get_weights(ytrain)]
            if sqrt_balance_weights:
                balance_weights = [torch.sqrt(w) for w in balance_weights]
        else:
            print('I dont do balancing on the outputs because Idk how that would work')
    
    hashcode = str(hash(','.join([str(i) for i in train_ids])))
    save_file = save_path + 'model_' + model.identifier + '_split' + str(split) + '_resample' + str(resample_training) +  '_hash' + hashcode + file_suffix + '.tar'
    xtrain = df_to_torch(xtrain).to(device)
    
    xtest = df_to_torch(xtest).to(device)
    ytrain = [df_to_torch(t).to(device) for t in ytrain]
    ytest= [df_to_torch(t).to(device) for t in ytest]
    
    model.fit_normalizer(xtrain)
    
    optimizer = torch.optim.Adam(model.parameters(),lr=lr)
    best_val_loss = 1000000000000000000000000000
    best_loss_metrics = {}
    last_epoch = False
    for epoch in range(epochs):
        
        model.train(True)
        optimizer.zero_grad()
        
        xtrain_sample = xtrain#[torch.randint(len(xtrain),(len(xtrain),) )]
        ypred = model(xtrain_sample,n_samples=1)
        loss = lfunc(ytrain,ypred,weights=weights,subweights=balance_weights)

        loss.backward()
        optimizer.step()
        if verbose:
            print('epoch',epoch,'train loss',loss.item())
        
        model.eval()
        yval = model(xtest,n_samples=1)
        val_loss = lfunc(ytest,yval,weights=weights,subweights=balance_weights)
        if state < 3:
            val_metrics = state_metrics(ytest,yval)
        else:
            val_metrics = outcome_metrics(ytest,yval)
        if val_loss.item() < best_val_loss:
            best_val_loss = val_loss.item()
            best_loss_metrics = val_metrics
            steps_since_improvement = 0
            torch.save(model.state_dict(),save_file)
        else:
            steps_since_improvement += 1
        if verbose:
            print('val loss',val_loss.item())
            print('______________')
        if steps_since_improvement > patience:
            break
    print('best loss',best_val_loss,best_loss_metrics)
    model.load_state_dict(torch.load(save_file))
    
    #train one step on validation data
    for i in range(n_validation_trainsteps):
        model.train()
        yval = model(xtest,n_samples=1)
        val_loss = lfunc(ytest,yval,weights=weights)
        val_loss.backward()
        optimizer.step()
        torch.save(model.state_dict(),save_file)
    
    model.eval()
    print(model(xtest))
    return model,  best_val_loss, best_loss_metrics

print('training transition models')
t1_args = {'hidden_layers': [500,500],
   'dropout': 0.5,
   'input_dropout': 0.1}
tm1 = train_state(model_args=t1_args,state=1,lr=.0001,weights=[1,1,.1,1],balanced=False)
tm2 = train_state(model_args=t1_args,state=2,lr=.001,weights=[1,1,.01,1],balanced=False)
tm3 = train_state(model_args=t1_args,state=3,lr=.0001,weights=[.01,1,1,.01],balanced=False)

#save models to resources
tm1[0].set_device('cpu')
tm2[0].set_device('cpu')
tm3[0].set_device('cpu')

torch.save(tm1[0],'../resources/' + transition_model_files[0] +  '.pt')
torch.save(tm2[0],'../resources/' + transition_model_files[0] +  '.pt')
torch.save(tm3[0],'../resources/' + transition_model_files[0] +  '.pt')

print('transition models trained. Training DSM')
dsm_model, dsm_loss, dsm_metrics = train_dsm(DTDataset(use_smote=False), k=6, dist="LogNormal",layers=[100],elbo=False, activation='Tanh',input_dropout=.1)

print('dsm trained')
print(dsm_metrics)
torch.save(dsm_model,'../resources/' + dsm_model_file+'.pt')

def temporal_loss(timestoevents,weights=None,maxtime=48,threshold=True):
    #list of expected times to events, usualy in order of Const.temporal_outcomes
    #basically longer = better, we count > maxtime (weeks) as no event
    if weights is None: 
        weights = [1 for i in range(len(timestoevents))]
    scores =  [(w*maxtime/t)for w,t in zip(weights,timestoevents)]
    if threshold:
        scores = [s*torch.lt(t,maxtime) for s,t in zip(scores,timestoevents)]
    scores = torch.stack(scores).sum(axis=0)
    return scores

def outcome_loss(ypred,weights=None):
    #default weights is bad
    if weights is None: 
        print('using default outcome loss weights, which is probably wrong since bad stuff should be negative')
        weights = [1 for i in range(ypred.shape[1])]
    l = torch.mul(ypred[:,0],weights[0])
    for i,weight in enumerate(weights[1:]):
        #weights with negative values will invert the outcome so e.g. Regional control becomes no regional control
        #so the penaly is correct
        newloss = torch.mul(ypred[:,i+1],weight)
        l = torch.add(l,newloss)
    return l

def calc_optimal_decisions(dataset,ids,m1,m2,m3,sm3,
                           weights=[0,0.5,.5,0], #weight for OS, FT, AS, and LRC as binary probabilities
                           tweights=[1,1,1,1], #weight for OS, LRC, FDM, and event (any + FT or AS at 6m) as time to event in weeks
                           outcome_loss_func=None,
                           threshold_temporal_loss = False,
                           maxtime=48,
                           get_transitions=True):
    m1.eval()
    m2.eval()
    m3.eval()
    sm3.eval()
    device = m1.get_device()
    data = dataset.processed_df.copy().loc[ids]
    
    def get_dlt(state):
        if state == 2:
            return data[Const.dlt2].copy()
        d = data[Const.dlt1].copy()
        if state < 1:
            d.values[:,:] = 0
        return d
    
    def get_pd(state):
        if state == 2:
            return data[Const.primary_disease_states2].copy()
        d = data[Const.primary_disease_states].copy()
        if state < 1:
            d.values[:,:] = 0
        return d
    
    def get_nd(state):
        if state == 2:
            return data[Const.nodal_disease_states2].copy()
        d = data[Const.nodal_disease_states].copy()
        if state < 1:
            d.values[:,:] = 0
        return d
    
    def get_cc(state):
        res = data[Const.ccs].copy()
        if state == 1:
            res.values[:,:] = np.zeros(res.values.shape)
        return res
    
    def get_mod(state):
        res = data[Const.modifications].copy()
        #this should have an ic condition but we don't use it anumore anywa
        return res
        
    def formatdf(d):
        d = df_to_torch(d).to(device)
        return d
    
    
    outcomedf = data[Const.outcomes]
    baseline = dataset.get_state('baseline').loc[ids]
    baseline_input = formatdf(baseline)

        
    if outcome_loss_func is None:
        outcome_loss_func = outcome_loss
    
    cat = lambda x: torch.cat([xx.to(device) for xx in x],axis=1).to(device)
    format_transition = lambda x: x.to(device)
    def get_outcome(d1,d2,d3):
        d1 = torch.full((len(ids),1),d1).type(torch.FloatTensor)
        d2 = torch.full((len(ids),1),d2).type(torch.FloatTensor)
        d3 = torch.full((len(ids),1),d3).type(torch.FloatTensor)
        
        tinput1 = cat([baseline_input,d1])
        ytransition = m1(tinput1)
        [ypd1,ynd1,ymod,ydlt1] = [format_transition(xx) for xx in ytransition['predictions']]
        d1_thresh = torch.gt(d1,.5).view(-1,1).to(device)
        ypd1[:,0:2] = ypd1[:,0:2]*d1_thresh
        ynd1[:,0:2] = ynd1[:,0:2]*d1_thresh
        
        tinput2 = cat([baseline_input,ypd1,ynd1,ymod,ydlt1,d1,d2])
        ytransition2 = m2(tinput2)
        [ypd2,ynd2,ycc,ydlt2] = [format_transition(xx) for xx in ytransition2['predictions']]
        
        input3 = cat([baseline_input, ypd2, ynd2, ycc, ydlt2, d1, d2,d3])
        outcome = m3(input3)['predictions']
        temporal_outcomes = sm3.time_to_event(input3,n_samples=1)
        
        transitions = {
            'pd1': ypd1,
            'nd1': ynd1,
            'nd2': ynd2,
            'pd2': ypd2,
            'mod': ymod,
            'cc': ycc,
            'dlt1': ydlt1,
            'dlt2': ydlt2,
        }
        return outcome, temporal_outcomes, transitions

    losses = []
    loss_order = []
    transitions = {}
    for d1 in [0,1]:
        for d2 in [0,1]:
            for d3 in [0,1]:
                outcomes, tte, transition_entry = get_outcome(d1,d2,d3)
                loss = outcome_loss_func(outcomes,weights)
                tloss = temporal_loss(tte,tweights,maxtime=maxtime,threshold=threshold_temporal_loss)
                loss += tloss
                losses.append(loss)
                loss_order.append([d1,d2,d3])
                transitions[str(d1)+str(d2)+str(d3)] = transition_entry
    losses = torch.stack(losses,axis=1)
    optimal_decisions = [loss_order[i] for i in torch.argmin(losses,axis=1)]
    result = torch.tensor(optimal_decisions).type(torch.FloatTensor)
    print(result.sum(axis=0),result.shape[0])
    if get_transitions:
        opt_transitions = {k: torch.zeros(v.shape).type(torch.FloatTensor) for k,v in transitions['000'].items()}
        for i,od in enumerate(optimal_decisions):
            key = ''.join([str(o) for o in od])
            entry = transitions[key]
            for kk,vv in entry.items():
                opt_transitions[kk][i,:] = vv[i,:]
        return result, opt_transitions
    return result

def get_unique_sequence(array):
    #converts a row of boolean values to a unique number e.g. [1,1,0] => 11, [0,0,1] => 100
    uniqueify = lambda r: torch.sum(torch.stack([i*(10**ii) for ii,i in enumerate(r)]))
    return torch_apply_along_axis(uniqueify,array)

def train_decision_model_triplet(
    tmodel1,
    tmodel2,
    tmodel3,
    smodel3,
    use_default_split=True,
    use_bagging_split=False,
    use_attention=True,
    lr=.001,
    epochs=10000,
    patience=5,
    weights=[0,.5,.5,0], #realtive weight of survival, feeding tube, aspiration, andl lrc
    tweights=[1,1,1,0], #weight for OS, LRC, FDM, and event (any + FT or AS at 6m) as time to event in weeks
    opt_weights=[1,1,1], #weights for policy model for optimal decisions
    imitation_weights=[.5,1,1],#weights of imitation decisions, because ic overtrains too quickly
    imitation_weight=1,
    reward_weight=1,
    imitation_triplet_weight=2,
    reward_triplet_weight = 2,
    shufflecol_chance = 0.2,
    split=.7,
    resample_training=False,
    save_path='../data/models/',
    file_suffix='',
    verbose=True,
    use_gpu=False,
    **model_kwargs,
):
    tmodel1.eval()
    tmodel2.eval()
    tmodel3.eval()

    train_ids, test_ids = get_tt_split(use_default_split=use_default_split,use_bagging_split=use_bagging_split,resample_training=resample_training)
    true_ids = train_ids + test_ids #for saving memory without upsampling

    dataset = DTDataset()
    data = dataset.processed_df.copy()
    
    def get_dlt(state):
        if state == 2:
            return data[Const.dlt2].copy()
        d = data[Const.dlt1].copy()
        if state < 1:
            d.values[:,:] = 0
        return d
    
    def get_pd(state):
        if state == 2:
            return data[Const.primary_disease_states2].copy()
        d = data[Const.primary_disease_states].copy()
        if state < 1:
            d.values[:,:] = 0
        return d
    
    def get_nd(state):
        if state == 2:
            return data[Const.nodal_disease_states2].copy()
        d = data[Const.nodal_disease_states].copy()
        if state < 1:
            d.values[:,:] = 0
        return d
    
    def get_cc(state):
        res = data[Const.ccs].copy()
        if state == 1:
            res.values[:,:] = np.zeros(res.values.shape)
        return res
    
    def get_mod(state):
        res = data[Const.modifications].copy()
        #this should have an ic condition but we don't use it anumore anywa
        return res
        
    outcomedf = data[Const.outcomes]
    baseline = dataset.get_state('baseline')
    
    def formatdf(d,dids=train_ids):
        d = df_to_torch(d.loc[dids]).to(model.get_device())
        return d
    
    def makegrad(v):
        if not v.requires_grad:
            v.requires_grad=True
        return v
    
    if use_attention:
        model = DecisionAttentionModel(baseline.shape[1],**model_kwargs)
    else:
        model_kwargs = {k:v for k,v in model_kwargs.items() if 'attention' not in k and 'embed' not in k}
        model = DecisionModel(baseline.shape[1],**model_kwargs)
        
    device = 'cpu'
    if use_gpu and torch.cuda.is_available():
        device = 'cuda'
        
    model.set_device(device)

    tmodel1.set_device(device)
    tmodel2.set_device(device)
    tmodel3.set_device(device)
    smodel3.set_device(device)
    hashcode = str(hash(','.join([str(i) for i in train_ids])))
    
    save_file = save_path + 'model_' + model.identifier +'_hash' + hashcode + file_suffix + '.tar'
    model.fit_normalizer(df_to_torch(baseline.loc[train_ids]))
    optimizer = torch.optim.Adam(model.parameters(),lr=lr)
    
    
    optimal_train,transitions_train = calc_optimal_decisions(dataset,train_ids,tmodel1,tmodel2,tmodel3,smodel3,
                                           weights=weights,tweights=tweights,
                                          )
    optimal_test,transitions_test = calc_optimal_decisions(dataset,test_ids,tmodel1,tmodel2,tmodel3,smodel3,
                                          weights=weights,tweights=tweights,
                                         )
    optimal_train = optimal_train.to(model.get_device())
    optimal_test = optimal_test.to(model.get_device())
    mse = torch.nn.MSELoss()
    bce = torch.nn.BCELoss()
    
    def compare_decisions(d1,d2,d3,ids):
#         ypred = np.concatenate([dd.cpu().detach().numpy().reshape(-1,1) for dd in [d1,d2,d3]],axis=1)
        ytrue = df_to_torch(outcomedf.loc[ids])
        dloss = bce(d1.view(-1),ytrue[:,0])
        dloss += bce(d2.view(-1),ytrue[:,1])
        dloss += bce(d3,view(-1),ytrue[:,2])
        return dloss
        
    def remove_decisions(df):
        cols = [c for c in df.columns if c not in Const.decisions ]
        ddf = df[cols]
        return ddf
    
    makeinput = lambda step,dids: df_to_torch(remove_decisions(dataset.get_input_state(step=step,ids=dids)))
    threshold = lambda x: torch.gt(x,torch.rand(x.shape[0])).type(torch.FloatTensor)

    randchoice = lambda x: x[torch.randint(len(x),(1,))[0]]
    tloss_func = torch.nn.TripletMarginLoss()
    def get_tloss(row,step,yt,x,imitation=True):
        if yt[:,step].std() < .001:
            return torch.tensor([0]).to(device)
        positive_idx= torch.nonzero(yt[:,step] == yt[row,step])
        if len(positive_idx) <= 1:
            print('no losses','n positive',len(positive_idx),'yt',yt[row,step],'row',row,'step',step,'imitation',imitation,end='\r')
            return torch.tensor([0]).to(device)
        positive_idx = torch.stack([ii for ii in positive_idx if ii != row]).view(-1)
        negative_idx = torch.tensor([ii for ii in range(x.shape[0]) if ii not in positive_idx and ii != row])
        if len(positive_idx) < 1 or len(negative_idx) < 1:
            print('no losses','n positive',len(positive_idx),'n negative',len(negative_idx),'yt',yt[row,step],'row',row,'step',step,'imitation',imitation,end='\r')
            return torch.tensor([0]).to(device)
        positive = x[randchoice(positive_idx)]
        negative = x[randchoice(negative_idx)]
        anchor = x[row]
        if use_attention:
            [anchor_embedding,pos_embedding,neg_embedding] = [model.get_embedding(xx.view(1,-1),position=step,use_saved_memory=True) for xx in [anchor,positive,negative]]
        else:    
            [anchor_embedding,pos_embedding,neg_embedding] = [model.get_embedding(xx.view(1,-1),position=step,concatenate=False)[int(imitation)] for xx in [anchor,positive,negative]]
        tloss = tloss_func(anchor_embedding,pos_embedding,neg_embedding)
        return tloss
    #save the inputs from the whole dataset for future reference
    if use_attention:
        full_data = []
        for mstep in [0,1,2]:
            full_data_step = [baseline, get_dlt(min(mstep,1)),
                         get_dlt(mstep),get_pd(mstep),get_nd(mstep),get_cc(mstep),get_mod(mstep)]
            full_data_step = torch.cat([formatdf(fd,true_ids) for fd in full_data_step],axis=1)
            full_data.append(full_data_step)
        full_data = torch.stack(full_data)
        model.save_memory(full_data)
        print(full_data.shape)
        
    def step(train=True):
        if train:
            model.train(True)
            tmodel1.train(True)
            tmodel2.train(True)
            tmodel3.train(True)
            optimizer.zero_grad()
            ids = train_ids
            y_opt = makegrad(optimal_train)
            transition_dict = {k: torch.clone(v).detach() for k,v in transitions_train.items()}
        else:
            ids = test_ids
            model.eval()
            tmodel1.eval()
            tmodel2.eval()
            tmodel3.eval()
            y_opt = makegrad(optimal_test)
            print(y_opt.mean(axis=0))
            transition_dict = {k: torch.clone(v).detach() for k,v in transitions_test.items()}
        model.set_device(device)
        ytrain = df_to_torch(outcomedf.loc[ids]).to(device)
        #imitation losses and decision 1
        xxtrained = [baseline, get_dlt(0),get_dlt(0),get_pd(0),get_nd(0),get_cc(0),get_mod(0)]
        xxtrain = [formatdf(xx,ids) for xx in xxtrained]
        xxtrain = torch.cat(xxtrain,axis=1).to(device)
        o1 = model(xxtrain,position=0,use_saved_memory= (not train))
        decision1_imitation = o1[:,3]
        decision1_opt = o1[:,0]
    
        imitation_loss1 = bce(decision1_imitation,ytrain[:,0])
        imitation_loss1 = torch.mul(imitation_loss1,imitation_weights[0])
        opt_loss1 = bce(decision1_opt,y_opt[:,0])
        opt_loss1 = torch.mul(opt_loss1,opt_weights[0])
        
        x1_imitation = [baseline, get_dlt(1),get_dlt(0),get_pd(1),get_nd(1),get_cc(1),get_mod(1)]
        x1_imitation = [formatdf(xx1,ids) for xx1 in x1_imitation]
        x1_imitation = torch.cat(x1_imitation,axis=1).to(device)
        
        o2 = model(x1_imitation,position=1,use_saved_memory= (not train))
            
        decision2_imitation = o2[:,4]
            
        imitation_loss2 =  bce(decision2_imitation,ytrain[:,1])
        imitation_loss2 = torch.mul(imitation_loss2,imitation_weights[1])
        
        
        x2_imitation = [baseline, get_dlt(1),get_dlt(2),get_pd(2),get_nd(2),get_cc(2),get_mod(2)]
        
        x2_imitation = [formatdf(xx2,ids) for xx2 in x2_imitation]
        x2_imitation = torch.cat(x2_imitation,axis=1).to(device)
        
        
        o3 = model(x2_imitation,position=2,use_saved_memory= (not train))
        
        decision3_imitation = o3[:,5]
        
        imitation_loss3 = bce(decision3_imitation,ytrain[:,2])
        imitation_loss3 = torch.mul(imitation_loss3,imitation_weights[2])
        
        opt_input2 = [
            formatdf(baseline,ids), 
            transition_dict['dlt1'],
            formatdf(get_dlt(0),ids),
            transition_dict['pd1'],
            transition_dict['nd1'], 
            formatdf(get_cc(0),ids),
            transition_dict['mod']
                 ]
        opt_input2 = [o.to(device) for o in opt_input2]

        opt_input2 = torch.cat(opt_input2,axis=1).to(device)
        decision2_opt = model(opt_input2,position=1,use_saved_memory= (not train))[:,1]
        
        opt_loss2 = bce(decision2_opt,y_opt[:,1])
        opt_loss2 = torch.mul(opt_loss2,opt_weights[1])
        
        opt_input3 = [
            formatdf(baseline,ids),
            transition_dict['dlt1'],
            transition_dict['dlt2'],
            transition_dict['pd2'],
            transition_dict['nd2'],
            transition_dict['cc'],
            transition_dict['mod'],
        ]
        opt_input3 = [o.to(device) for o in opt_input3]
        opt_input3 = torch.cat(opt_input3,axis=1).to(device)
        decision3_opt = model(opt_input3,position=2,use_saved_memory= (not train))[:,2]
        
        opt_loss3 = bce(decision3_opt,y_opt[:,2])
        opt_loss3 = torch.mul(opt_loss3,opt_weights[2])
        
        iloss = torch.add(torch.add(imitation_loss1,imitation_loss2),imitation_loss3)
        iloss = torch.mul(iloss,imitation_weight)
        
        reward_loss = torch.add(torch.add(opt_loss1,opt_loss2),opt_loss3)
        reward_loss =torch.mul(reward_loss,reward_weight)
        
        loss = torch.add(iloss,reward_loss)
        
        imitation_tloss = torch.FloatTensor([0]).to(device)
        opt_tloss = torch.FloatTensor([0]).to(device)
        n_rows = xxtrain.shape[0]
        if reward_triplet_weight + imitation_triplet_weight > 0.0001:
            for i in range(n_rows):
                
                if imitation_triplet_weight > .0001:
                    imitation_tloss += get_tloss(i,0,ytrain,xxtrain,True)
                    imitation_tloss += get_tloss(i,1,ytrain,x1_imitation,True)
                    imitation_tloss += get_tloss(i,2,ytrain,x2_imitation,True)
                if reward_triplet_weight > .0001:
                    opt_tloss += get_tloss(i,0,y_opt,xxtrain,False)
                    opt_tloss += get_tloss(i,1,y_opt,opt_input2,False)
                    opt_tloss += get_tloss(i,2,y_opt,opt_input3,False)
            loss += torch.mul(imitation_tloss[0],imitation_triplet_weight/n_rows)
            loss += torch.mul(opt_tloss[0],reward_triplet_weight/n_rows)
        losses = [iloss,reward_loss,imitation_tloss*imitation_triplet_weight/n_rows,opt_tloss*reward_triplet_weight/n_rows]
        
        if train:
            loss.backward()
            optimizer.step()
            return losses
        else:
            scores = []
            distributions = [decision1_opt.mean().item(),decision2_opt.mean().item(),decision3_opt.mean().item()]
            imitation = [decision1_imitation,decision2_imitation,decision3_imitation]
            optimal = [decision1_opt,decision2_opt,decision3_opt]
            for i,decision_im in enumerate(imitation):
                deci = decision_im.cpu().detach().numpy()
                deci0 = (deci > .5).astype(int)
                iout = ytrain[:,i].cpu().detach().numpy()
                acci = accuracy_score(iout,deci0)
                try:
                    auci = roc_auc_score(iout,deci)
                except:
                    auci = -1
                
                deco = optimal[i].cpu().detach().numpy()
                deci0 = (deco > .5).astype(int)
                oout = y_opt[:,i].cpu().detach().numpy()
                acco = accuracy_score(oout,deci0)
                try:
                    auco = roc_auc_score(oout,deco)
                except:
                    auco=-1
                scores.append({'decision': i,'optimal_auc': auco,'imitation_auc': auci,'optimal_acc': acco,'imitation_acc': acci})
            return losses, scores, distributions
        
    best_val_loss = torch.tensor(1000000000.0)
    steps_since_improvement = 0
    best_val_score = {}
    
    for epoch in range(epochs):
        losses = step(True)
        val_losses,val_metrics,val_distributions = step(False)
        vl = val_losses[0] + val_losses[1]
        for vm in val_metrics:
            vl += (-((vm['optimal_auc']*reward_weight) + (vm['imitation_auc']*imitation_weight)))/10
        if verbose:
            print('______epoch',str(epoch),'_____')
            print('val reward',val_losses[1].item())
            print('imitation reward', val_losses[0].item())
            print('distance losses',val_losses[2].item(),val_losses[-1].item())
            print('distributions',val_distributions)
            print(val_metrics)
        if vl < best_val_loss:
            best_val_loss = vl
            best_val_score = val_metrics
            best_val_distributions = val_distributions
            steps_since_improvement = 0
            torch.save(model.state_dict(),save_file)
        else:
            steps_since_improvement += 1
        if steps_since_improvement > patience:
            break
    print('++++++++++Final+++++++++++')
    print('best',best_val_loss)
    print(best_val_score)
    model.load_state_dict(torch.load(save_file))
    model.eval()
    return model, best_val_score, best_val_loss, best_val_distributions

args = {
    'hidden_layers': [1000,1000], 
    'opt_layer_size': 20, 
    'imitation_layer_size': 20, 
    'dropout': 0.25, 
    'input_dropout': 0.1, 
    'shufflecol_chance': 0.5
}

decision_model, decision_score, decision_loss, _ = train_decision_model_triplet(
    tm1[0],tm2[0],tm3[0],dsm_model,
    lr=.01,
    imitation_weight=1,
    reward_weight=1,
    patience=100,
    imitation_triplet_weight=0.1,
    reward_triplet_weight =0.1, 
    verbose=True,
    weights=[1,1,1,1], #realtive weight of survival, feeding tube, aspiration, andl lrc
    tweights=[1,1,1,0], #weight for OS, LRC, FDM, and event (any + FT or AS at 6m) as time to event in weeks
    use_attention=True,
    **args)

print('decision model trained')
print(decision_score)
decision_model.set_device('cpu')
torch.save(decision_model,'../resources/' + policy_model_file + '.pt')
pd.DataFrame(decision_score).to_csv('../results/policy_model_score_temp.csv')