import torch
# import numpy as np
import pandas as pd
import numpy as np
from Constants import Const
from captum.attr import IntegratedGradients
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV



class SimulatorBase(torch.nn.Module):
    
    def __init__(self,
                 input_size,
                 hidden_layers = [1000],
                 dropout = 0.5,
                 input_dropout=0.1,
                 state = 1,
                 eps = 0.01,
                 add_decision_passthrough=True,
                ):
        #predicts disease state (sd, pr, cr) for primar and nodal, then dose modications or cc type (depending on state), and [dlt ratings]
        torch.nn.Module.__init__(self)
        self.state = state
        self.input_dropout = torch.nn.Dropout(input_dropout)
        
        self.passthrough = add_decision_passthrough
        first_layer =torch.nn.Linear(input_size,hidden_layers[0],bias=True)
        layers = [first_layer,torch.nn.ReLU()]
        curr_size = hidden_layers[0]
        for ndim in hidden_layers[1:]:
            layer = torch.nn.Linear(curr_size,ndim)
            curr_size = ndim
            layers.append(layer)
            layers.append(torch.nn.ReLU())
        self.layers = torch.nn.ModuleList(layers)
        self.batchnorm = torch.nn.BatchNorm1d(hidden_layers[-1])
        self.dropout = torch.nn.Dropout(dropout)
        self.relu = torch.nn.Softplus()
    
        input_mean = torch.tensor([0])
        input_std = torch.tensor([1])
        self.eps = eps
        self.register_buffer('input_mean', input_mean)
        self.register_buffer('input_std',input_std)
        
        self.sigmoid = torch.nn.Sigmoid()
        self.softmax = torch.nn.Softmax(dim=1)
        self.identifier = 'state'  +str(state) + '_input'+str(input_size) + '_dims' + ','.join([str(h) for h in hidden_layers]) + '_dropout' + str(input_dropout) + ',' + str(dropout)
    
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
#         x = (x - self.input_mean + self.eps)/(self.input_std + self.eps)
#         return x
    
    def fit_normalizer(self,x):
        input_mean = x.mean(axis=0)
        input_std = x.std(axis=0)
        self.register_buffer('input_mean', input_mean)
        self.register_buffer('input_std',input_std)
        return True
    
    def get_attributions(self,x,output=-1,target=0):
        if output == -1:
            model = self
        else:
            model = lambda x: self.forward(x)[output]
        ig = IntegratedGradients(model)
        if isinstance(x,torch.Tensor):
            base = torch.zeros(x.shape)
        else:
            base = tuple([torch.zeros(xx.shape) for xx in x])
        attributions = ig.attribute(x,base,target=target)
        return attributions

class SimulatorAttentionBase(SimulatorBase):
    
    def __init__(self,input_size,
                 hidden_layers = [100],
                 attention_heads=[2], 
                 embed_size=100,
                 **kwargs,
                ):
        
        super().__init__(input_size,hidden_layers=hidden_layers,**kwargs)
        if embed_size == 0:
            attention_heads[0] = 1
            self.resize_layer = lambda x: x
        else:
            self.resize_layer = torch.nn.Linear(input_size,embed_size)
        #overrite layer intitialization
        layers = []
        attentions = []
        norms = []
        curr_size = embed_size
        i = 0
        for aheads,lindim in zip(attention_heads,hidden_layers):
            attention = torch.nn.MultiheadAttention(curr_size,aheads)
            linear = torch.nn.Linear(curr_size,lindim)
            norm = torch.nn.LayerNorm(curr_size)
            layers.append(linear)
            attentions.append(attention)
            norms.append(norm)
            curr_size = lindim
            
        self.layers = torch.nn.ModuleList(layers)
        self.attentions = torch.nn.ModuleList(attentions)
        self.norms = torch.nn.ModuleList(norms)
        self.final_layer = torch.nn.Linear(hidden_layers[-1],len(Const.decisions))
        self.activation = torch.nn.ReLU()
        self.register_buffer('memory',None)

    def save_memory(self,newmemory):
        self.memory= newmemory

# +
    
class ClusterImputer(SimulatorBase):
    def __init__(self,
                 input_size,
                 output_clusters=1,#how many different clusters we're inputing
                 n_clusters=3,#number of clusters per cluster group (currently only fixed idk)
                 hidden_layers = [100,100],
                 dropout = 0.3,
                 input_dropout=0,
                 state = 0,
                 **kwargs
                ):
        #predicts disease state (sd, pr, cr) for primar and nodal, then dose modications or cc type (depending on state), and [dlt ratings]
        super().__init__(input_size,hidden_layers=hidden_layers,dropout=dropout,input_dropout=input_dropout,state=0,**kwargs)
        self.n_clusters = n_clusters
        self.n_outputs = output_clusters
        final_dim = hidden_layers[-1]
        self.final_layers = torch.nn.ModuleList([torch.nn.Linear(final_dim,n_clusters) for i in range(output_clusters)])

   
    def get_output(self,xin,**kwargs):
        x = self.normalize(xin)
        x = self.input_dropout(x)
        for layer in self.layers:
            x = layer(x)
        x = self.dropout(x)
        xlist = [self.softmax(layer(x)) for layer in self.final_layers]
        return xlist
    
    def forward(self,x,**kwargs):
        return self.get_output(x)
    
class OutcomeSimulator(SimulatorBase):
    
    def __init__(self,
                 input_size,
                 hidden_layers = [500,500],
                 dropout = 0.7,
                 input_dropout=0.1,
                 state = 1,
                 **kwargs
                ):
        #predicts disease state (sd, pr, cr) for primar and nodal, then dose modications or cc type (depending on state), and [dlt ratings]
        super().__init__(input_size,hidden_layers=hidden_layers,dropout=dropout,input_dropout=input_dropout,state=state,**kwargs)
    
        final_dim = hidden_layers[-1]
        if self.passthrough:
            final_dim = final_dim + state
        self.disease_layer = torch.nn.Linear(final_dim,len(Const.primary_disease_states))
        self.nodal_disease_layer = torch.nn.Linear(final_dim,len(Const.nodal_disease_states))
        #dlt ratings are 0-4 even though they don't always appear
        self.dlt_layers = torch.nn.ModuleList([torch.nn.Linear(final_dim,1) for i in Const.dlt1])
        assert( state in [1,2])
        if state == 1:
#             self.dlt_layers = torch.nn.ModuleList([torch.nn.Linear(hidden_layers[-1],5) for i in Const.dlt1])
            self.treatment_layer = torch.nn.Linear(final_dim,len(Const.modifications))
        else:
            #we only have dlt yes or no for the second state?
#             self.dlt_layers = torch.nn.ModuleList([torch.nn.Linear(hidden_layers[-1],2) for i in Const.dlt2])
            self.treatment_layer = torch.nn.Linear(final_dim,len(Const.ccs))
   
    def get_output(self,xin):
        decisions = xin[:,xin.shape[1]-self.state:]
        x = self.normalize(xin)
        x = self.input_dropout(x)
        for layer in self.layers:
            x = layer(x)
#         x = self.batchnorm(x)
        x = self.dropout(x)
        if self.passthrough:
            x = torch.concat([x,decisions],axis=1)
        x_pd = self.disease_layer(x)
        x_nd = self.nodal_disease_layer(x)
        x_mod = self.treatment_layer(x)
        x_dlts = [layer(x) for layer in self.dlt_layers]
        
        #If I relu the dlts it breaks idk why
        #the rest needs an activation functiona tha makes everything non-negative so the zeroing out with no IC decisions works properly
        x_pd = self.relu(x_pd)
        x_nd = self.relu(x_nd)
        x_mod = self.relu(x_mod)
        
        #last input is decision 1 or 0, if we have no treatment on first decision we have not transitional outcomes so reflect that
        #this is hardcoded based on original order so check this if I change stuff
        #this only kind of works since I think it can end up all zero and softmaxes to .33% flat
        if self.state == 1:
            #pd and nd, shrink complete and partial response columns if decision is 0
            scale = torch.gt(xin[:,-1].view(-1,1),.5)
            x_pd= torch.mul(x_pd,scale)
            x_nd= torch.mul(x_nd,scale)
            #shrink all but "no modifications"
            x_mod[:,1:]  = torch.mul(x_mod[:,1:],scale)
        x_pd = self.softmax(x_pd)
        x_nd = self.softmax(x_nd)
        x_mod = self.softmax(x_mod)
        #dlts are array of nbatch x n_dlts x predictions
        x_dlts = torch.cat([self.sigmoid(xx) for xx in x_dlts],axis=1)
        #dlts I think are only for chemo so in both ic and cc we do zero if decision is 0
        #this is after sigmoid because the dlts don't use softmax like the other ones
        x_dlts = torch.mul(x_dlts,(xin[:,-1]).view(-1,1))
        xout = [x_pd, x_nd, x_mod, x_dlts]
        
        return xout
    
    def forward(self,x,**kwargs):
        return self.get_output(x)

class BayesianOutcomeSimulator(OutcomeSimulator):

    def quantile(self,xlist,q,from_ll=False):
        xshape = xlist[0].shape
        xx = torch.stack(xlist).view((len(xlist),-1))
        if from_ll:
            xx = torch.exp(xx)
        return xx.quantile(q,dim=0).view(xshape)
    
    def cf(self,xlist,ci=.1,**kwargs):
        lower = self.quantile(xlist,ci,**kwargs)
        upper = self.quantile(xlist,1-ci,**kwargs)
        return lower, upper
    
    def forward(self,xin,n_samples=20,**kwargs):
        if not self.training:
            self.disable_dropout()
        basex =  self.get_output(xin)
        if n_samples <= 1:
            return basex
        self.enable_dropout()
        xpd_range = []
        xnd_range = []
        xmod_range = []
        xdlt_range = []
        with torch.no_grad():
            for sample in range(n_samples):
                xx = self.get_output(xin)
                xpd_range.append(xx[0])
                xnd_range.append(xx[1])
                xmod_range.append(xx[2])
                xdlt_range.append(xx[3])
            xpd_range = self.cf(xpd_range,from_ll=False)
            xnd_range =self.cf(xnd_range,from_ll=False)
            xmod_range = self.cf(xmod_range,from_ll=False)
            xdlt_range = self.cf(xdlt_range,from_ll=False)
        entry  = {
            'predictions': basex,
            '5%': [xpd_range[0],xnd_range[0],xmod_range[0],xdlt_range[0]],
            '95%':  [xpd_range[1],xnd_range[1],xmod_range[1],xdlt_range[1]],
            'order': ['pd','nd','mod','dlt']
        }
        return entry

# +
class EndpointSimulator(SimulatorBase):
    
    def __init__(self,
                 input_size,
                 hidden_layers = [500],
                 dropout = 0.7,
                 input_dropout=0.1,
                 state = 1,
                ):
        #predicts disease state (sd, pr, cr) for primar and nodal, then dose modications or cc type (depending on state), and [dlt ratings]
        super().__init__(input_size,hidden_layers=hidden_layers,dropout=dropout,input_dropout=input_dropout,state=state)
        
        self.outcome_layer = torch.nn.Linear(hidden_layers[-1],len(Const.outcomes))
      
        
    def get_output(self,x):
        x = self.normalize(x)
        x = self.input_dropout(x)
        for layer in self.layers:
            x = layer(x)
#         x = self.batchnorm(x)
        x = self.dropout(x)
        x= self.outcome_layer(x)
        x = self.sigmoid(x)
        return x
    
    def forward(self,x,**kwargs):
        return self.get_output(x)
    
class BayesianEndpointSimulator(EndpointSimulator):
    
    def average(self,xlist,from_ll=True):
        if from_ll:
            xlist = [torch.exp(xx) for xx in xlist]
        if len(xlist) < 2:
            return xlist[0]
        else:
            return torch.stack(xlist).mean(dim=0) 
        
    def quantile(self,xlist,q,from_ll=False):
        xshape = xlist[0].shape
        xx = torch.stack(xlist).view((len(xlist),-1))
        #if the simulator outputs a log loss
        if from_ll:
            xx = torch.exp(xx)
        return xx.quantile(q,dim=0).view(xshape)
    
    def cf(self,xlist,ci=.1,**kwargs):
        lower = self.quantile(xlist,ci,**kwargs)
        upper = self.quantile(xlist,1-ci,**kwargs)
        return lower, upper
    
    def forward(self,xin,n_samples=20,**kwargs):
        if not self.training:
            self.disable_dropout()
        basex =  self.get_output(xin)
        if n_samples <= 1:
            return basex
        self.enable_dropout()
        xrange =[]
        with torch.no_grad():
            for sample in range(n_samples):
                xx = self.get_output(xin)
                xrange.append(xx)
            [x5, x95] = self.cf(xrange,from_ll=False)
        entry = {
            'predictions': basex,
            '5%':x5,
            '95%':  x95,
        }
        return entry
    
class TransitionEnsemble(torch.nn.Module):
    
    def __init__(self,base_models,error_models,ci=.1):
        super().__init__()
        self.base_models = torch.nn.ModuleList(base_models)
        self.error_models = torch.nn.ModuleList(error_models)
        self.register_buffer('ci',torch.FloatTensor([ci]))
    
    def set_device(self,device,**kwargs):
        super().to(device)
        for model in self.base_models:
            model.set_device(device,**kwargs)
        for model in self.error_models:
            model.set_device(device,**kwargs)
    
    def get_device(self):
        return next(self.parameters()).device
    
    def average(self,xlist,from_ll=False):
        if from_ll:
            xlist = [torch.exp(xx) for xx in xlist]
        if len(xlist) < 2:
            return xlist[0]
        else:
            return torch.stack(xlist).mean(dim=0) 
        
    def quantile(self,xlist,q,from_ll=False):
        xshape = xlist[0].shape
        xx = torch.stack(xlist).view((len(xlist),-1))
        if from_ll:
            xx = torch.exp(xx)
        return xx.quantile(q,dim=0).view(xshape)
    
    def cf(self,xlist,**kwargs):
        lower = self.quantile(xlist,self.ci.item(),**kwargs)
        upper = self.quantile(xlist,1-self.ci.item(),**kwargs)
        return lower, upper
    
    def forward(self,x):
        x = x.to(self.get_device())
        xpd = []
        xpd_range = []
        xnd = []
        xnd_range = []
        xmod = []
        xmod_range = []
        xdlt = []
        xdlt_range = []
        for m in self.base_models:
            xx = m(x)
            xpd.append(xx[0])
            xnd.append(xx[1])
            xmod.append(xx[2])
            xdlt.append(xx[3])
            xpd_range.append(xx[0])
            xnd_range.append(xx[1])
            xmod_range.append(xx[2])
            xdlt_range.append(xx[3])
        for m in self.error_models:
            xx = m(x)
            xpd_range.append(xx[0])
            xnd_range.append(xx[1])
            xmod_range.append(xx[2])
            xdlt_range.append(xx[3])
        xpd = self.average(xpd)
        xnd = self.average(xnd)
        xmod = self.average(xmod)
        xdlt = self.average(xdlt,from_ll=False)
        
        xpd_range = self.cf(xpd_range,)
        xnd_range =self.cf(xnd_range)
        xmod_range = self.cf(xmod_range)
        xdlt_range = self.cf(xdlt_range,from_ll=False)
        entry = {
            'predictions': [xpd,xnd,xmod,xdlt],
            '5%': [xpd_range[0],xnd_range[0],xmod_range[0],xdlt_range[0]],
            '95%':  [xpd_range[1],xnd_range[1],xmod_range[1],xdlt_range[1]],
            'order': ['pd','nd','mod','dlt']
        }
        return entry
    
class EndpointEnsemble(TransitionEnsemble):
    
    def __init__(self,base_models,error_models,ci=.1):
        super().__init__(base_models,error_models,ci=ci)
    
    def forward(self,x):
        x=x.to(self.get_device())
        xlist = []
        xrange =[]
        for m in self.base_models:
            xx = m(x)
            xlist.append(xx)
            xrange.append(xx)
        for m in self.error_models:
            xx = m(x)
            xrange.append(xx)
        xlist = self.average(xlist,from_ll=False)
        [x5, x95] = self.cf(xrange,from_ll=False)
        entry = {
            'predictions': xlist,
            '5%':x5,
            '95%':  x95,
        }
        return entry


# -

class DecisionModel(SimulatorBase):
    
    def __init__(self,
                 baseline_input_size,#number of baseline features used
                 hidden_layers = [100],
                 opt_layer_size=100,
                 imitation_layer_size=100,
                 dropout = 0.5,
                 input_dropout=0.1,
                 state = 1,
                 eps = 0.01,
                 **kwargs,
                 ):
        #input will be all states up until treatment 3
        input_size = baseline_input_size  + 2*len(Const.dlt1) + len(Const.primary_disease_states)  + len(Const.nodal_disease_states)  + len(Const.ccs)  + len(Const.modifications) + 2
    
        super().__init__(input_size,hidden_layers=hidden_layers,dropout=dropout,input_dropout=input_dropout,eps=eps,state='decisions')
        self.final_opt_layer = torch.nn.Linear(hidden_layers[-1],opt_layer_size)
        self.final_imitation_layer = torch.nn.Linear(hidden_layers[-1],imitation_layer_size)
        self.final_layer = torch.nn.Linear(imitation_layer_size+opt_layer_size,2*len(Const.decisions))
        self.baseline_input_size= baseline_input_size
        self.input_sizes = {
            'baseline': baseline_input_size,
            'dlt': len(Const.dlt1),
            'pd': len(Const.primary_disease_states),
            'nd': len(Const.nodal_disease_states),
            'cc': len(Const.ccs),
            'modifications': len(Const.modifications),
        }
        self.sigmoid = torch.nn.Sigmoid()
        self.dummy_param = torch.nn.Parameter(torch.empty(0))
        
        
    def add_position_token(self,x,position):
        #add 2 binary variables for if the state has already passed
        if position == 0:
            token = torch.zeros((x.shape[0],2)).to(self.get_device())
            x = torch.cat([x,token],dim=1).to(self.get_device())
        if position == 1:
            token1 = torch.ones((x.shape[0],1)).to(self.get_device())
            token2 = torch.zeros((x.shape[0],1)).to(self.get_device())
            x = torch.cat([x,token1,token2],dim=1).to(self.get_device())
        if position == 2:
            token1 = torch.zeros((x.shape[0],1)).to(self.get_device())
            token2 = torch.ones((x.shape[0],1)).to(self.get_device())
            x = torch.cat([x,token1,token2],dim=1)
        if position == 3:
            token1 = torch.ones((x.shape[0],1)).to(self.get_device())
            token2 = torch.ones((x.shape[0],1)).to(self.get_device())
            x = torch.cat([x,token1,token2],dim=1).to(self.get_device())
        return x
    
    def get_embedding(self,x,position=0,concatenate=True,**kwargs):
        xbase = x[:,0:self.baseline_input_size]
        xx = x[:,self.baseline_input_size:]
        xbase = self.normalize(xbase)
        x = torch.cat([xbase,xx],dim=1)
        x = self.add_position_token(x,position)
        for layer in self.layers:
            x = layer(x)
        x = self.dropout(x)
        xopt = self.final_opt_layer(x)
        xim = self.final_imitation_layer(x)
        if concatenate:
            return torch.cat([xopt,xim],axis=1)
        return [xopt,xim]
    
    def get_attributions(self,x,output=-1,target=0,base=None,**kwargs):
        device= self.get_device()
        x = x.to(device)
        if output == -1:
            model = lambda x: self.forward(x,**kwargs)
        else:
            model = lambda x: self.forward(x,**kwargs)[output]
        ig = IntegratedGradients(model)
        if base is None:
            base = torch.zeros(x.shape).to(device)
        attributions = ig.attribute(x,base,target=target)
        return attributions
    
    def forward(self,x,position=0,use_saved_memory=None,**kwargs):
        #use save memory is purely so I don't need an if statement for the attention version
        x = x.to(self.get_device())
        x = self.get_embedding(x,position=position)
        x = self.final_layer(x)
        x = self.sigmoid(x)
        return x



class DecisionAttentionModel(DecisionModel):
    
    def __init__(self,
                 baseline_input_size,#number of baseline features used
                 hidden_layers = [100],
                 attention_heads=[5], 
                 embed_size=100,
                 dropout = 0.5,
                 input_dropout=0.1,
                 state = 1,
                 eps = 0.01,
                 calculate_spread=True,
                 ln_group_positions = [[0, 2, 4, 6, 8, 10, 12, 14, 16, 36],[1, 3, 5, 7, 9, 11, 13, 15, 17, 37]],
                **kwargs,
                 ):
        #input will be all states up until treatment 3
        input_size = baseline_input_size  + 2*len(Const.dlt1) + len(Const.primary_disease_states)  + len(Const.nodal_disease_states)  + len(Const.ccs)  + len(Const.modifications) + 2
        super().__init__(input_size,hidden_layers=hidden_layers,dropout=dropout,input_dropout=input_dropout,eps=eps,state='decisions')
        #must be after call
        self.baseline_input_size=baseline_input_size
        #if we do live feature engineering by summing the number of nodes
        #currently uses just #ipsilateral and #contralateral, may do other stuff idk
        #will need to update positions if I chane other input features
        if calculate_spread:
            input_size += len(ln_group_positions)
        self.ln_group_positions = ln_group_positions
        self.calculate_spread = calculate_spread
        
        
        self.input_sizes = {
            'baseline': baseline_input_size,
            'dlt': len(Const.dlt1),
            'pd': len(Const.primary_disease_states),
            'nd': len(Const.nodal_disease_states),
            'cc': len(Const.ccs),
            'modifications': len(Const.modifications),
        }
        #to make the input to attention divisible by the initial layer size
        #all layer sizes and embed size need to be divisible by all attention heads
        if embed_size == 0:
            attention_heads[0] = 1
            self.resize_layer = lambda x: x
            curr_size = input_size
        else:
            self.resize_layer = torch.nn.Linear(input_size,embed_size)
            torch.nn.init.xavier_uniform_(self.resize_layer.weight)
            curr_size = embed_size
        #overrite layer intitialization
        layers = []
        attentions = []
        norms = []
        
        i = 0
        for aheads,lindim in zip(attention_heads,hidden_layers):
            attention = torch.nn.MultiheadAttention(curr_size,aheads)
            linear = torch.nn.Linear(curr_size,lindim)
            torch.nn.init.xavier_uniform_(linear.weight)
            norm = torch.nn.LayerNorm(curr_size)
            layers.append(linear)
            attentions.append(attention)
            norms.append(norm)
            curr_size = lindim
            
        self.layers = torch.nn.ModuleList(layers)
        self.attentions = torch.nn.ModuleList(attentions)
        self.norms = torch.nn.ModuleList(norms)
        self.final_layer = torch.nn.Linear(hidden_layers[-1],len(Const.decisions)*2)
        torch.nn.init.xavier_uniform_(self.final_layer.weight)
        self.activation = torch.nn.ReLU()
        self.register_buffer('memory',None)
    

    def get_ln_spreads(self,xbase):
        spreads = torch.zeros((xbase.shape[0],len(self.ln_group_positions)))
        for i,idxgroup in enumerate(self.ln_group_positions):
            spread = torch.sum(xbase[:,idxgroup],dim=1)
            spread = torch.div(spread,len(idxgroup))
            spreads[:,i] = spread.view(-1)
        return spreads.to(self.get_device())
    
    def get_embedding(self,x,position=0,memory=None,use_saved_memory=False,**kwargs):
        x = x.to(self.get_device())
        xbase = x[:,0:self.baseline_input_size]
        if self.calculate_spread:
            spreads = self.get_ln_spreads(xbase)
        xx = x[:,self.baseline_input_size:]
        xbase = self.normalize(xbase)
        if self.calculate_spread:
            xbase = torch.cat([xbase,spreads],dim=1)
        x = torch.cat([xbase,xx],dim=1)
        x = self.input_dropout(x)
        x = self.add_position_token(x,position)
        x = self.activation(self.resize_layer(x))
        if use_saved_memory:
            memory = self.memory
            #if I use mutliple stages it will be the first axis
            if memory is not None and memory.ndim > 2:
                memory = memory[position]
            if memory is None:
                print('passed saved to decision model but no memory has been saved')
        if memory is not None:
            m1 = memory[:,0:self.baseline_input_size]
            if self.calculate_spread:
                m1_spread = self.get_ln_spreads(m1)
            m2 = memory[:,self.baseline_input_size:]
            m1 = self.normalize(m1)
            if self.calculate_spread:
                m1  = torch.cat([m1,m1_spread],dim=1)
            memory = torch.cat([m1,m2],dim=1)
            memory = self.add_position_token(memory,position)
            memory = self.activation(self.resize_layer(memory))
        i = len(self.attentions)
        for attention,layer,norm in zip(self.attentions,self.layers,self.norms):
            if memory is not None:
                x2, attention_weights = attention(x,memory,memory)
                x2 = norm(x2 + x)
            else:
                x2, attention_weights = attention(x,x,x)
                x2 = norm(x2+x)
                i = 0
            x2 = self.activation(x2)
            x = layer(x2)
            x = self.activation(x)
            if i > 1:
                memory2, _ = attention(memory,memory,memory)
                memory = norm(memory2+memory)
                memory = self.activation(memory)
                memory = layer(memory)
                memory = self.activation(memory)
                i -= 1
        return x
    
    def save_memory(self,newmemory):
        self.memory= newmemory
    
    def get_attributions(self,x,output=-1,target=0,base=None,**kwargs):
        device= self.get_device()
        x = x.to(device)
        if output == -1:
            model = lambda x: self.forward(x,**kwargs)
        else:
            model = lambda x: self.forward(x,**kwargs)[output]
        ig = IntegratedGradients(model)
        if self.memory is not None:
            if self.memory.ndim < 3:
                m = self.memory
            else:
                pos = kwargs.get('position',2)
                m = self.memory[pos]
            m = m.to(device)
        if base is None:
            base = torch.zeros(x.shape).to(device)
        attributions = ig.attribute(x,base,target=target)
        return attributions
    
    def forward(self,x,position=0,memory=None,use_saved_memory=False):
        #position is 0-2
        x = self.get_embedding(x,position=position,memory=memory,use_saved_memory=use_saved_memory)
        x = self.dropout(x)
        x = self.final_layer(x)
        x = self.sigmoid(x)
        return x


class OutcomeAttentionSimulator(SimulatorAttentionBase):
    
    def __init__(self,
                 input_size,
                 hidden_layers = [500],
                 attention_heads=[4], 
                 embed_size=100,
                 dropout = 0.5,
                 input_dropout=0.1,
                 state = 1,
                ):
        #predicts disease state (sd, pr, cr) for primar and nodal, then dose modications or cc type (depending on state), and [dlt ratings]
        super().__init__(input_size,hidden_layers=hidden_layers,dropout=dropout,input_dropout=input_dropout,state=state)
        
        self.disease_layer = torch.nn.Linear(hidden_layers[-1],len(Const.primary_disease_states))
        self.nodal_disease_layer = torch.nn.Linear(hidden_layers[-1],len(Const.nodal_disease_states))
        #dlt ratings are 0-4 even though they don't always appear
        
        self.dlt_layers = torch.nn.ModuleList([torch.nn.Linear(hidden_layers[-1],1) for i in Const.dlt1])
        assert( state in [1,2])
        if state == 1:
#             self.dlt_layers = torch.nn.ModuleList([torch.nn.Linear(hidden_layers[-1],5) for i in Const.dlt1])
            self.treatment_layer = torch.nn.Linear(hidden_layers[-1],len(Const.modifications))
        else:
            #we only have dlt yes or no for the second state?
#             self.dlt_layers = torch.nn.ModuleList([torch.nn.Linear(hidden_layers[-1],2) for i in Const.dlt2])
            self.treatment_layer = torch.nn.Linear(hidden_layers[-1],len(Const.ccs))
        
        
    def forward(self,x,memory=None,use_saved_memory=False):
        decision = x[:,-1]
        x = self.normalize(x)
        x = self.input_dropout(x)
        x = self.activation(self.resize_layer(x))
        
        if use_saved_memory:
            memory = self.memory
            if memory is None:
                print('passed bad memory argument to transition model ',self.state)
        if memory is not None:
            memory = self.normalize(memory)
            memory = self.activation(self.resize_layer(memory))
        i = len(self.attentions)
        for attention,layer,norm in zip(self.attentions,self.layers,self.norms):
            if memory is not None:
                x2, attention_weights = attention(x,memory,memory)
            else:
                x2, attention_weights = attention(x,x,x)
            x2 = norm(x2+x)
            x2 = self.activation(x2)
            x = layer(x2)
            x = self.activation(x)
            if i > 1:
                memory2, _ = attention(memory,memory,memory)
                memory = norm(memory2+memory)
                memory = self.activation(memory)
                memory = layer(memory)
                memory = self.activation(memory)
                i -= 1
        x = self.dropout(x)
        x_pd = self.disease_layer(x)
        x_nd = self.nodal_disease_layer(x)
        x_mod = self.treatment_layer(x)
        
        if self.state == 1:
            #pd and nd, shrink complete and partial response columns if decision is 0
            scale = torch.gt(decision.view(-1,1),.5)
            x_pd= torch.mul(x_pd,scale)
            x_nd= torch.mul(x_nd,scale)
            #shrink all but "no modifications"
            x_mod[:,1:]  = torch.mul(x_mod[:,1:],scale)
        x_dlts = [layer(x) for layer in self.dlt_layers]
        
        x_pd = self.softmax(x_pd)
        x_nd = self.softmax(x_nd)
        x_mod = self.softmax(x_mod)
        #dlts are array of nbatch x n_dlts x predictions
        x_dlts = torch.cat([self.sigmoid(xx) for xx in x_dlts],axis=1)
        return [x_pd, x_nd, x_mod, x_dlts]

class EndpointAttentionSimulator(SimulatorAttentionBase):
    
    def __init__(self,
                 input_size,
                 hidden_layers = [500],
                 attention_heads=[2],
                 dropout = 0.7,
                 input_dropout=0.1,
                 embed_size=500,
                 state = 1,
                ):
        #predicts disease state (sd, pr, cr) for primar and nodal, then dose modications or cc type (depending on state), and [dlt ratings]
                    
        super().__init__(input_size,
                         hidden_layers=hidden_layers,
                         attention_heads=attention_heads,
                         dropout=dropout,input_dropout=input_dropout,
                         embed_size=embed_size,
                         state=state)
        
        self.outcome_layer = torch.nn.Linear(hidden_layers[-1],len(Const.outcomes))
        
        
    def forward(self,x):
        x = self.normalize(x)
        x = self.input_dropout(x)
        x = self.activation(self.resize_layer(x))
        for attention,layer,norm in zip(self.attentions,self.layers,self.norms):
            x2, attention_weights = attention(x,x,x)
            x2 = norm(x2+x)
            x2 = self.activation(x2)
            x = layer(x2)
            x = self.activation(x)
        x = self.dropout(x)
        x= self.outcome_layer(x)
        x = self.sigmoid(x)
        return x

def df_to_torch(df,ttype  = torch.FloatTensor):
    values = df.values.astype(float)
    values = torch.from_numpy(values)
    return values.type(ttype)


# +
def resample_array(x,y=None):
    shape = [i for i in range(x.shape[0])]
    idx = np.random.choice(shape,replace=True,size=x.shape[0])
    if y is not None:
        assert x.shape[0] == y.shape[0]
        return x[idx],y[idx]
    return x[idx]

class SingleOutcomeEnsembleWrapper():
    
    def __init__(self,models,outcome,error_models=None,ci=.1):
        self.base_models = models
        self.error_models = None
        self.device = 'cpu'
        self.x = None
        self.y = None
        self.ci = ci
        self.return_type = torch.FloatTensor
        self.outcome=outcome
        
    def set_device(self,device,**kwargs):
        self.device = device
        return True
    
    def get_device(self):
        return self.device
    
    def numpyify(self,x):
        is_torch = isinstance(x,torch.Tensor)
        if is_torch:
            x = x.cpu().detach().numpy()
        if isinstance(x,pd.DataFrame):
            x = x.values
        return x.astype(float)
    
    def save_training_data(self,x,y):
        self.x = x
        self.y = y
    
    def get_input_size(self):
        if self.x is None:
            return 0
        return self.x.shape[0]
        
    def fit_models(self,x,y,n_bootstraps =10,save_data=True,verbose=False):
        if save_data:
            self.save_training_data(x,y)
        x = self.numpyify(x)
        y = self.numpyify(y)
        if y.ndim > 1 and y.shape[1] > 1:
            if y.sum(axis=1).max() > 1.0000001:
                print('bad sum?',self.outcome,y[0:3,:])
            y = np.argmax(y,axis=1)
        y = y.ravel()
        error_models = []
        for i,model in enumerate(self.base_models):
            self.base_models[i] = model.fit(x,y)
        while len(error_models) < n_bootstraps:
            xtemp, ytemp = resample_array(x,y)
            #error in case of issue with calibration due to small sample sizes
            try:
                for model in self.base_models:
                    tempmodel = clone(model)
                    error_models.append(tempmodel.fit(xtemp,ytemp))
            except Exception as e:
                if verbose:
                    print('resampling issue',e)
                
    def __call__(self,x):
        x = self.numpyify(x)
        ys = [model.predict_proba(x.astype(np.float32)) for model in self.base_models]
        if self.error_models is not None:
            y_err = [model.predict_proba(x) for model in self.error_models]
        else:
            y_err = ys
        if len(ys) < 2:
            ypred = ys[0]
        else:
            ypred = np.stack(ys).mean(axis=0)
        if len(y_err) < 2:
            y_lower = y_err[0]
            y_upper = y_err[0]
        else:
            [y_lower, y_upper] = np.quantile(np.stack(y_err),[self.ci,1-self.ci],axis=0)
        outcome = [ypred, y_lower, y_upper]
        #for boolean outcomes just return probability of true to match how I do torch models
        if outcome[0].shape[1] == 2:
            outcome = [o[:,1] for o in outcome]
        return [torch.from_numpy(arr).type(self.return_type).to(self.device) for arr in outcome]
    
class OutcomeEnsembleWrapper():
    
    def __init__(self,model_list,model_order=None,to_group=[],groupname='',state=1,*args,**kwargs):
        super().__init__(*args,**kwargs)
        m_dict = {m.outcome: m for m in model_list}
        if model_order is None:
            model_order = [m.outcome for m in model_list]
        self.models = [m_dict[n] for n in model_order]
        self.model_names = model_order
        self.device = model_list[0].get_device()
        self.to_group =  [m for m in self.model_names if m in to_group]
        self.groupname = groupname
        self.state = state
        
    def get_model(self,name):
        if name not in self.model_order:
            return None
        idx = self.model_order.index(name)
        return self.models[idx]
    
    def eval(self,**kwargs):
        return
    
    def train(self,*args,**kwargs):
        return
    
    def set_device(self,device):
        self.device=device
        return
    
    def get_device(self):
        return self.device
    
    def fit_models(self,x,ylist,**kwargs):
        assert len(ylist) == len(self.models)
        for m,y in zip(self.models,ylist):
            m.fit_models(x,y,**kwargs)
        return True
    
    def get_input_size(self):
        return self.modes[0].get_input_size()
    
    def __call__(self,x):
        outcomes = []
        lower_ci = []
        upper_ci = []
        pos = 0
        ogroup = []
        lgroup = []
        ugroup = []
        #todo: group dlts like I do in other stuff
        order = []
        for model in self.models:
            [ypred, ylower, yupper] = model(x)
            if model.outcome not in self.to_group:
                outcomes.append(ypred)
                lower_ci.append(ylower)
                upper_ci.append(yupper)
                order.append(model.outcome)
            else:
                ogroup.append(ypred)
                lgroup.append(ylower)
                ugroup.append(yupper)
        if len(ogroup) > 0:
            ogroup = torch.stack(ogroup,axis=1)
            lgroup = torch.stack(lgroup,axis=1)
            ugroup = torch.stack(ugroup,axis=1)
            outcomes.append(ogroup)
            lower_ci.append(lgroup)
            upper_ci.append(ugroup)
        if len(self.to_group):
            order.append(self.groupname)
        if self.state == 3:
            outcomes = torch.stack(outcomes,axis=1)
        entry = {
            'predictions': outcomes,
            '5%': lower_ci,
            '95%': upper_ci,
            'order': order,
        }
        return entry
    
