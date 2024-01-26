#This repo is a modified version of the Deep Survival Model code from https://github.com/autonlab/auton-survival/tree/master/auton_survival/models/dsm
#specifically for mutiple outcomes and to be in pure pytorch with a joint embedding, with the models modified based on needs
#it also allows for median time to event for lognormal loss, which works the best
import torch 
import torch.nn as nn
import numpy as np
from sklearn.metrics import roc_auc_score,f1_score,balanced_accuracy_score,matthews_corrcoef
from Utils import *
from Misc import *

# +
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
    
def create_representation(inputdim, layers, activation, bias=False):
    if activation == 'ReLU6': act = nn.ReLU6()
    elif activation == 'ReLU': act = nn.ReLU()
    elif activation == 'SeLU': act = nn.SELU()
    elif activation == 'Tanh': act = nn.Tanh()
    elif activation == 'Sigmoid': act = nn.Sigmoid()
    modules = []
    prevdim = inputdim

    for hidden in layers:
        modules.append(nn.Linear(prevdim, hidden, bias=bias))
        modules.append(act)
        prevdim = hidden
    return nn.Sequential(*modules)

def format_tte_outcome(dataset,outcome,ids=None,**kwargs):
    #turns the timeseires censored output into an array of shape n_timepoints
    df = dataset.processed_df
    if ids is not None:
        df = df.loc[ids]
    values = df[outcome].values
    if outcome != 'time_to_event':
        idx = Const.timeseries_outcomes.index(outcome)
        event = df[Const.timeseries_censoring[idx]].values
    elif outcome == 'time_to_event':
        event = df[['FT', 'Aspiration rate Post-therapy']+Const.timeseries_censoring].apply(lambda x: np.sum(x) >= len(x),axis=1).values
    did_they_not_die_early = (df['OS (Calculated)'].values >= values).astype(int)
    event = np.multiply(event,did_they_not_die_early)
    event = 1-event
    return torch.tensor(event), torch.tensor(values)

def format_tte_outcomes(dataset,outcomes,**kwargs):
    events = []
    times = []
    for outcome in outcomes:
        e,t = format_tte_outcome(dataset,outcome,**kwargs)
        events.append(e)
        times.append(t)
    events = torch.stack(events)
    times = torch.stack(times)
    return events,times

def pretrain_dsm(dataset,
                 dist,
                 model=None,
                 outcomes = ['time_to_event'],
                 lr=.1,
                 epochs=100000,
                 patience=10,
                 verbose=2,
                 save_file=None,**model_kwargs):
    train_ids, test_ids = get_tt_split(dataset.processed_df.reset_index())
    
    state = 3
    xtrain = df_to_torch(dataset.get_input_state(step=state,ids=train_ids))
    #event series (1 = happend, 0 = didn't happen or already happened), t = 1-d list of times used of shape ytrain.shape[1]
    ytrain, ttrain = format_tte_outcomes(dataset,outcomes,ids=train_ids)
    if model is None:
        model = DSM(xtrain.shape[1],dist=dist,outcomes=outcomes,**model_kwargs)
    model.fit_normalizer(xtrain)
    model.train()
    if model.dist != "Normal":
        lossfunc = lognormal_loss
    optimizer = torch.optim.Adam(model.parameters(),lr=lr)
    best_loss = 100000000000000000000000
    steps_since_improvement = 0
    if save_file is None: save_file= '../data/models/dsm_'+''.join(outcomes)+'.tar'
    for epoch in range(epochs):
        optimizer.zero_grad()
        curr_loss = 0
        for i in range(len(outcomes)):
            shape, scale = model.get_shape_scale(i)
            curr_loss +=unconditional_loss(shape,scale,ttrain[i],ytrain[i],model.k,model.dist)
        curr_loss.backward()
        if verbose > 1:
            print('pretrain epoch',epoch,'loss',curr_loss.item(),end='\r')
        optimizer.step()
        if curr_loss.item() < best_loss:
            best_loss = curr_loss.item()
            steps_since_improvement = 0
            torch.save(model.state_dict(),save_file)
        else:
            steps_since_improvement += 1
            if steps_since_improvement > patience:
                break
    model.load_state_dict(torch.load(save_file))
    if verbose > 1:
        print('best pretrain loss',best_loss,'epochs',epoch)
    return model


def eval_model(model, xtest, ttest,ytest,timepoints = None,outcome_names=None):
    #ttest is time of event, ytest is if it happened at all
    if timepoints is None:
        timepoints = [12,24,36,48]
    ypreds = model(xtest,t=timepoints)
    allres = {}
    if outcome_names is None:
        outcome_names = [str(i) for i in range(model.n_outcomes)]
    for i, outcome in enumerate(outcome_names):
        res = {}
        for ii,time in enumerate(timepoints):
            ypred =ypreds[i][ii].cpu().detach().numpy()
            ytrue = (ttest[i] >= time).cpu().detach().numpy()
            entry = {}
            entry['roc_score'] = roc_auc_score(ytrue,ypred)
            entry['f1'] = f1_score(ytrue,ypred >= .5)
            entry['matthews'] = matthews_corrcoef(ytrue,ypred >= .5)
            res[time] = entry
        allres[outcome] = res
    return allres

def train_dsm(dataset, outcomes=Const.timeseries_outcomes,
              save_file=None,main_epochs=1000,main_lr=.01,patience=10,dist='LogNormal',
              pretrain_epochs=10000,
              verbose= 2,
              **kwargs):
    #ok they do something different so like check this later?
    #the use this as a "premodel" and load the shape and scale weights?
    if save_file is None:
        save_file= '../data/models/dsm_'+''.join(outcomes)+'.tar'
        pretrain_save_file =  '../data/models/dsm_'+''.join(outcomes)+'_pretrain.tar'
        
    
    train_ids, test_ids = get_tt_split(dataset.processed_df.reset_index())
    
    state = 3
    xtrain = df_to_torch(dataset.get_input_state(step=state,ids=train_ids))
    xtest = df_to_torch(dataset.get_input_state(step=state,ids=test_ids))
    #n_outcomes by n_items, ytrain is event y/n, ttrain is time of event or last followup
    ytrain, ttrain = format_tte_outcomes(dataset,outcomes,ids=train_ids)
    ytest, ttest = format_tte_outcomes(dataset,outcomes,ids=test_ids)
    model = DSM(xtrain.shape[1],outcomes=outcomes,dist=dist,**kwargs)
    model.fit_normalizer(xtrain)
    premodel = pretrain_dsm(dataset,outcomes=outcomes,epochs=pretrain_epochs,save_file=pretrain_save_file,dist=dist,verbose=verbose,**kwargs)
    for i in range(premodel.n_outcomes):
        model.shape[i].data = premodel.shape[i].data
        model.scale[i].data = premodel.scale[i].data
    optimizer = torch.optim.Adam(model.parameters(),lr=main_lr)
    best_loss = 100000000000000
    best_metrics = {}
    steps_since_improvement = 0
    
    for epoch in range(main_epochs):
        optimizer.zero_grad()
        
        model.train()
        curr_loss = 0
        shapes,scales,logitss = model(xtrain)
        for i in range(model.n_outcomes):
            curr_loss += conditional_loss(shapes[i],scales[i],logitss[i],ttrain[i],ytrain[i],model.k,model.dist,discount=model.discount,elbo=model.elbo)/model.n_outcomes 
        curr_loss.backward()
        
        optimizer.step()
        with torch.no_grad():
            model.eval()
            shapes2,scales2,logitss2 = model(xtest)
            val_loss = 0
            for i in range(model.n_outcomes):
                val_loss += conditional_loss(shapes2[i],scales2[i],logitss2[i],ttest[i],ytest[i],model.k,model.dist,discount=model.discount,elbo=model.elbo)/model.n_outcomes 
            val_metrics= eval_model(model,xtest,ttest,ytest,outcome_names=outcomes)
        if verbose > 1:
            print('val loss',val_loss.item())
            print('val metrics',val_metrics)
            print('____')
        if val_loss.item() < best_loss:
            best_loss = val_loss.item()
            best_metrics = val_metrics
            steps_since_improvement = 0
            torch.save(model.state_dict(),save_file)
        else:
            steps_since_improvement += 1
            if steps_since_improvement > patience:
                break
    model.load_state_dict(torch.load(save_file))
    if verbose > 0:
        print('best_loss',best_loss)
        print(best_metrics)
    return model, best_loss, best_metrics

class DSM(torch.nn.Module):

    def _init_dsm_layers(self, lastdim, n_outcomes):
        #the repo I copied this from actually uses different activations and default params to 1, but those make my loss function immediately explode
        if self.dist == 'Weibull':
    
            self.act=nn.SELU()
            self.shape = torch.nn.ParameterList([nn.Parameter(-.01*torch.ones(self.k)) for i in range(n_outcomes)])
            self.scale = torch.nn.ParameterList([nn.Parameter(-.01*torch.ones(self.k)) for i in range(n_outcomes)])
        else:
            self.act = nn.Sigmoid() if self.dist == 'Normal' else nn.Tanh()
            self.shape = torch.nn.ParameterList([nn.Parameter(.1*torch.ones(self.k)) for i in range(n_outcomes)])
            self.scale = torch.nn.ParameterList([nn.Parameter(.1*torch.ones(self.k)) for i in range(n_outcomes)])
     
        self.gate = torch.nn.ModuleList([nn.Sequential( nn.Linear(lastdim, self.k, bias=False) ) for i in range(n_outcomes)])

        self.scaleg =  torch.nn.ModuleList([nn.Sequential( nn.Linear(lastdim, self.k, bias=True) ) for i in range(n_outcomes)])

        self.shapeg = torch.nn.ModuleList([nn.Sequential( nn.Linear(lastdim, self.k, bias=False) ) for i in range(n_outcomes)])

    def __init__(self, inputdim, k=3, layers=None, 
                 dist='Weibull',
               temp=1000., discount=1.0, optimizer='Adam',
               input_dropout=0,
               embedding_dropout=0.5,
                 activation='ReLU6',
                 outcomes=None,
                 elbo=True,
                ):
        super().__init__()
        #I'm only using lognormal because weibull explosed
        assert(k > 0)
        self.k = int(k)
        assert(dist in ['Weibull','Normal','LogNormal'])
        self.dist = dist
        self.temp = float(temp)
        self.discount = float(discount)
        self.optimizer = optimizer
        if outcomes is None:
            outcomes = Const.timeseries_outcomes[:]
        n_outcomes = len(outcomes)
        self.n_outcomes= n_outcomes
        self.outcome_names = outcomes
        if layers is None: layers = [1000]
        self.layers = layers
        self.elbo = elbo

        if len(layers) == 0: lastdim = inputdim
        else: lastdim = layers[-1]

        self._init_dsm_layers(lastdim+3,n_outcomes)
        self.activation_name=activation
        self.embedding = create_representation(inputdim, layers, activation)
        self.input_dropout = nn.Dropout(input_dropout)
        self.embedding_dropout = nn.Dropout(embedding_dropout)
        self.squish = nn.Softmax(dim=1) if dist == "Normal" else nn.LogSoftmax(dim=1)
        
        input_mean = torch.tensor([0])
        input_std = torch.tensor([1])
        self.eps = .0001
        self.register_buffer('input_mean', input_mean)
        self.register_buffer('input_std',input_std)

    def set_device(self,device,**kwargs):
        self.to(device)
        self.input_mean = self.input_mean.to(device)
        self.input_std = self.input_std.to(device)
        for parameter in self.parameters():
            parameter.to(device)
    
    def get_device(self):
        return next(self.parameters()).device
    
    def enable_dropout(self):
        for m in self.modules():
            if m.__class__.__name__.startswith('Dropout'):
                m.train()
    
    def disable_dropout(self):
        for m in self.modules():
            if m.__class__.__name__.startswith('Dropout'):
                m.eval()
        
    def normalize(self,x):
        x = torch.subtract(x,self.input_mean)
        x = torch.add(x, self.eps)
        x= torch.div(x,self.input_std+self.eps)
        return x
    
    def fit_normalizer(self,x):
        input_mean = x.mean(axis=0)
        input_std = x.std(axis=0)
        self.register_buffer('input_mean', input_mean)
        self.register_buffer('input_std',input_std)
        return True
    
    def meantime(self,shape,scale,logits):
        #this if for the normal distribution?
        #So i'm sort of guessing for the lognormal (which is median time no mean) but it tests seem to get that is the equivalent time of suvival = .49
        
        #all the commented stuff is the things I tried to get weibull time to event to work
        
        #Ok so the equation they give more for weibull doesn't work, I just calculate median time via brute for assuming it's between 5 and 200 months
#         if self.dist == "Weibull":
#             times = list(range(5,52))
#             probs =[torch.exp(c).T for c in self._cdf(shape,scale,logits,times)]
#             probs = torch.stack(probs,axis=0)
#             best = torch.argmin(torch.abs(.5 - probs),axis=0)
#             return torch.Tensor([times[b] for b in best])

        k_ =  shape
        b_ = scale
        logits = self.squish(logits)
        
        lmeans = []
        for g in range(self.k):
            if self.dist == 'Weibull':
                k = k_[:,g]
                b = b_[:,g]
                one_over_k = torch.reciprocal(torch.exp(k))
                lmean = -(one_over_k*b) + torch.lgamma(1+one_over_k)
                
#                 k = k_[:, g]
#                 b = torch.exp(b_[:, g])
#                 onek = torch.reciprocal(k)
#                 lmean = torch.pow(b,-onek)*torch.pow(torch.log(torch.tensor([2])),onek)
#                 lmean = torch.exp(lmean)
                
#                 onek = torch.reciprocal(torch.exp(k))
#                 lmean  = -(b*onek)*torch.pow(torch.log(torch.tensor([2])),onek)
#                 print('lmean',lmean.mean(),onek.mean(),torch.pow(b,onek).mean(), torch.pow(torch.log(torch.tensor([2])),onek).mean() )

                lmeans.append(lmean)
            elif self.dist == 'LogNormal':
                sigma = b_[:,g]
                mu = k_[:,g]
                lmeans.append(torch.exp(mu))
            else:
                mu = k_[:, g]
                lmeans.append(mu)
        lmeans = torch.stack(lmeans, dim=1)
        if self.dist == 'Weibull':
            print('lmeans',lmeans,'logits',torch.exp(logits))
            
#             lmeans = lmeans*torch.exp(logits)
#             lmeans = torch.sum(lmeans,dim=1)

            lmeans = lmeans+logits
            lmeans = torch.logsumexp(lmeans,dim=1)
            lmeans = torch.exp(lmeans)
            return lmeans
        elif self.dist == 'LogNormal':
            lmeans = lmeans*torch.exp(logits)
            lmeans = torch.sum(lmeans,dim=1)
        else:
            lmeans = lmeans*logits
            lmeans = torch.sum(lmeans, dim=1)
        return lmeans

    def _cdf(self,shape,scale,logits,t_horizon):
        k_ =  shape
        b_ = scale
        logits = self.squish(logits)
        if isinstance(t_horizon,float) or isinstance(t_horizon,int):
            t_horizon = [t_horizon]
        t_horz = torch.tensor(t_horizon).double().to(logits.device)
        t_horz = t_horz.repeat(shape.shape[0], 1)
        
        cdfs = []
        for j in range(len(t_horizon)):
            t = t_horz[:, j]
            lcdfs = []

            for g in range(self.k):
                if self.dist == "Weibull":
                    k = k_[:, g]
                    b = b_[:, g]
                    s = - (torch.pow(torch.exp(b)*t, torch.exp(k)))
                else:
                    mu = k_[:, g]
                    sigma = b_[:, g]
                    if self.dist == 'LogNormal':
                        s = torch.div(torch.log(t) - mu, torch.exp(sigma)*np.sqrt(2))
                    else:
                        s = torch.div(t - mu, torch.exp(sigma)*np.sqrt(2))
                    s = 0.5 - 0.5*torch.erf(s)
                    s = torch.log(s)
                lcdfs.append(s)

            lcdfs = torch.stack(lcdfs, dim=1)
            lcdfs = lcdfs+logits
            lcdfs = torch.logsumexp(lcdfs, dim=1)
            
            cdfs.append(lcdfs)

        return cdfs

    def quantile(self,xlist,q):
        xshape = xlist[0].shape
        xx = torch.stack(xlist).view((len(xlist),-1))
        return xx.quantile(q,dim=0).view(xshape)
    
    def cf(self,xlist,ci=.1,**kwargs):
        lower = self.quantile(xlist,ci,**kwargs)
        upper = self.quantile(xlist,1-ci,**kwargs)
        return lower, upper
    
    def predict_time(self,x,**kwargs):
        #returns a list of tensors shape (x.shape[0]), one for each outcome with median(?) time (in weeks or whatever time unit in trianing is)
        shapes, scales, logitss = self.forward(x,t=None,**kwargs)
        survivals = []
        means = []
        for shape, scale, logits in zip(shapes,scales,logitss):
            meantime = self.meantime(shape,scale,logits)
            means.append(meantime)
        return means
        
    def time_to_event(self,x, n_samples = 10,**kwargs):
        base_times = self.predict_time(x,**kwargs)
        if n_samples == None or n_samples < 2:
            return base_times
        else:
            self.enable_dropout()
            all_times = [[] for i in range(self.n_outcomes)]
            for n in range(n_samples):
                times = self.predict_time(x,**kwargs)
                for i,time in enumerate(times):
                    all_times[i] = all_times[i] + [time]
            upper = []
            lower = []
            for tlist in all_times:
                [l,u] = self.cf(tlist)
                upper.append(u)
                lower.append(l)
            entry = {
                'predictions': base_times,
                '5%': lower,
                '95%': upper,
                'order': self.outcome_names,
            }
            if not self.train:
                self.disable_dropout()
            return entry
        
    def forward(self, x, t=None,**kwargs):
        """The forward function that is called when data is passed through DSM.

        Args:
          x:
            a torch.tensor of the input features.

        """
        x = self.normalize(x)
        #add a pass-through layer for decisions
        decisions = x[:,x.shape[1]-3:]
        x = self.input_dropout(x)
        xrep = self.embedding(x)
        xrep = self.embedding_dropout(xrep)
        xrep = torch.cat([xrep,decisions],axis=1)
        dim = x.shape[0]
        
        shapes = []
        scales = []
        logitss = []
        survivals = []
        for i in range(self.n_outcomes):
            shape = self.act(self.shapeg[i](xrep)) + self.shape[i].expand(dim,-1)
            scale = self.act(self.scaleg[i](xrep)) + self.scale[i].expand(dim,-1)
            logits = self.gate[i](xrep)/self.temp
        
            if t is None:
                shapes.append(shape)
                scales.append(scale)
                logitss.append(logits)
            else:
                cdf = self._cdf(shape,scale,logits,t)
                survival = [torch.exp(c).T for c in cdf]
                survivals.append(survival)
        if t is None:
            return shapes, scales, logitss
        return survivals

    def get_shape_scale(self,i=None, **kwargs):
        if i is None:
            return(self.shape, self.scale)
        assert(i < self.n_outcomes and i >= 0)
        return (self.shape[i],self.scale[i])
    
def unconditional_loss(shape,scale,t,e,k,dist):
    assert(dist in ['Weibull','Normal',"LogNormal"])
    if dist == 'Weibull':
        return weibull_loss(shape,scale,t,e,k)
    if dist == 'Normal':
        return normal_loss(shape,scale,t,e,k)
    return lognormal_loss(shape,scale,t,e,k)

def conditional_loss(shape,scale,logits,t,e,k,dist,**kwargs):
    assert(dist in ['Weibull','Normal',"LogNormal"])
    if dist == 'Weibull':
        return conditional_weibull_loss(shape,scale,logits,t,e,k,**kwargs)
    if dist == 'Normal':
        return conditional_normal_loss(shape,scale,logits,t,e,k,**kwargs)
    return conditional_lognormal_loss(shape,scale,logits,t,e,k,**kwargs)

def weibull_loss(shape,scale,t,e,kk):
    #so for like, all of these k_ is a parameter and k is the number of distributions idk why the repo I copied uses the term twice
    k_ = shape.expand(t.shape[0], -1)
    b_ = scale.expand(t.shape[0], -1)

    ll = 0.
    risk = 1
    for g in range(kk):

        k = k_[:, g]
        b = b_[:, g]

        s = - (torch.pow(torch.exp(b)*t, torch.exp(k)))
        f = k + b + ((torch.exp(k)-1)*(b+torch.log(t)))
        f = f + s

        uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
        cens = np.where(e.cpu().data.numpy() != int(risk))[0]
        ll += f[uncens].sum() + s[cens].sum()

    return -ll.mean()

def normal_loss(shape,scale,t,e,kk):

    k_ = shape.expand(t.shape[0], -1)
    b_ = scale.expand(t.shape[0], -1)
    ll = 0.
    risk=1
    for g in range(kk):

        mu = k_[:, g]
        sigma = b_[:, g]
        print('nloss',mu.mean(),sigma.mean())
        f = - sigma - 0.5*np.log(2*np.pi)
        print('f1',f.mean())
        f = f - 0.5*torch.div((t - mu)**2, torch.exp(2*sigma))
        print('f2',f.mean())
        s = torch.div(t - mu, torch.exp(sigma)*np.sqrt(2))
        print('s1',s.mean())
        s = 0.5 - 0.5*torch.erf(s)
        print('s2',s.mean())
        s = torch.log(s)
        print('s3',s.mean())
        uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
        cens = np.where(e.cpu().data.numpy() != int(risk))[0]
        ll += f[uncens].sum() + s[cens].sum()
    print(ll.mean())
    print('______')
    print()
    print()
    return -ll.mean()

def lognormal_loss(shape,scale,t,e,k):

    k_ = shape.expand(t.shape[0], -1)
    b_ = scale.expand(t.shape[0], -1)
    ll = 0.
    risk=1
    for g in range(k):

        mu = k_[:, g]
        sigma = b_[:, g]

        f = - sigma - 0.5*np.log(2*np.pi)
        f = f - torch.div((torch.log(t) - mu)**2, 2.*torch.exp(2*sigma))
        s = torch.div(torch.log(t) - mu, torch.exp(sigma)*np.sqrt(2))
        s = 0.5 - 0.5*torch.erf(s)
        s = torch.log(s)

        uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
        cens = np.where(e.cpu().data.numpy() != int(risk))[0]
        ll += f[uncens].sum() + s[cens].sum()

    return -ll.mean()

def conditional_normal_loss(shape,scale,logits, t, e, k, discount=1.0,elbo=True):

    alpha = discount

    lossf = []
    losss = []

    k_ = shape
    b_ = scale
    risk=1
    for g in range(k):

        mu = k_[:, g]
        sigma = b_[:, g]

        f = - sigma - 0.5*np.log(2*np.pi)
        f = f - torch.div((t - mu)**2, 2.*torch.exp(2*sigma))
        s = torch.div(t - mu, torch.exp(sigma)*np.sqrt(2))
        s = 0.5 - 0.5*torch.erf(s)
        s = torch.log(s)

        lossf.append(f)
        losss.append(s)

    losss = torch.stack(losss, dim=1)
    lossf = torch.stack(lossf, dim=1)

    if elbo:

        lossg = nn.Softmax(dim=1)(logits)
        losss = lossg*losss
        lossf = lossg*lossf

        losss = losss.sum(dim=1)
        lossf = lossf.sum(dim=1)

    else:

        lossg = nn.LogSoftmax(dim=1)(logits)
        losss = lossg + losss
        lossf = lossg + lossf

        losss = torch.logsumexp(losss, dim=1)
        lossf = torch.logsumexp(lossf, dim=1)

    uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
    cens = np.where(e.cpu().data.numpy() != int(risk))[0]
    ll = lossf[uncens].sum() + alpha*losss[cens].sum()

    return -ll/float(len(uncens)+len(cens))

def conditional_lognormal_loss(shape,scale,logits, t, e, kk, discount=1.0,elbo=True):

    alpha = discount

    lossf = []
    losss = []

    k_ = shape
    b_ = scale
    risk=1
    for g in range(kk):

        mu = k_[:, g]
        sigma = b_[:, g]

        f = - sigma - 0.5*np.log(2*np.pi)
        f = f - torch.div((torch.log(t) - mu)**2, 2.*torch.exp(2*sigma))
        s = torch.div(torch.log(t) - mu, torch.exp(sigma)*np.sqrt(2))
        s = 0.5 - 0.5*torch.erf(s)
        s = torch.log(s)

        lossf.append(f)
        losss.append(s)

    losss = torch.stack(losss, dim=1)
    lossf = torch.stack(lossf, dim=1)

    if elbo:

        lossg = nn.Softmax(dim=1)(logits)
        losss = lossg*losss
        lossf = lossg*lossf

        losss = losss.sum(dim=1)
        lossf = lossf.sum(dim=1)

    else:

        lossg = nn.LogSoftmax(dim=1)(logits)
        losss = lossg + losss
        lossf = lossg + lossf

        losss = torch.logsumexp(losss, dim=1)
        lossf = torch.logsumexp(lossf, dim=1)

    uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
    cens = np.where(e.cpu().data.numpy() != int(risk))[0]
    ll = lossf[uncens].sum() + alpha*losss[cens].sum()

    return -ll/float(len(uncens)+len(cens))

def conditional_weibull_loss(shape,scale,logits, t, e, kk, discount=1.0,elbo=True):

    alpha = discount
    k_ = shape
    b_ = scale

    lossf = []
    losss = []
    risk=1
    for g in range(kk):

        k = k_[:, g]
        b = b_[:, g]
        #So this explodes which is why I'm not using weibull loss anymore
        s = - (torch.pow(torch.exp(b)*t, torch.exp(k)))
        f = k + b + ((torch.exp(k)-1)*(b+torch.log(t)))
        f = f + s

        lossf.append(f)
        losss.append(s)

    losss = torch.stack(losss, dim=1)
    lossf = torch.stack(lossf, dim=1)
    if elbo:

        lossg = nn.Softmax(dim=1)(logits)
        losss = lossg*losss
        lossf = lossg*lossf
        losss = losss.sum(dim=1)
        lossf = lossf.sum(dim=1)

    else:

        lossg = nn.LogSoftmax(dim=1)(logits)
        losss = lossg + losss
        lossf = lossg + lossf
        losss = torch.logsumexp(losss, dim=1)
        lossf = torch.logsumexp(lossf, dim=1)

    uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
    cens = np.where(e.cpu().data.numpy() != int(risk))[0]
    ll = lossf[uncens].sum() + alpha*losss[cens].sum()

    return -ll/float(len(uncens)+len(cens))


# -


