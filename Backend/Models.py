import torch
# import numpy as np
import pandas as pd
from Constants import Const
from captum.attr import IntegratedGradients



class SimulatorBase(torch.nn.Module):
    
    def __init__(self,
                 input_size,
                 hidden_layers = [1000],
                 dropout = 0.5,
                 input_dropout=0.1,
                 state = 1,
                 eps = 0.01,
                ):
        #predicts disease state (sd, pr, cr) for primar and nodal, then dose modications or cc type (depending on state), and [dlt ratings]
        torch.nn.Module.__init__(self)
        self.state = state
        self.input_dropout = torch.nn.Dropout(input_dropout)
        
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
        self.softmax = torch.nn.LogSoftmax(dim=1)
        self.identifier = 'state'  +str(state) + '_input'+str(input_size) + '_dims' + ','.join([str(h) for h in hidden_layers]) + '_dropout' + str(input_dropout) + ',' + str(dropout)
    
    def set_device(self,device,**kwargs):
        self.to(device)
        self.input_mean = self.input_mean.to(device)
        self.input_std = self.input_std.to(device)
        for parameter in self.parameters():
            parameter.to(device)
    
    def get_device(self):
        return next(self.parameters()).device
    
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

class OutcomeSimulator(SimulatorBase):
    
    def __init__(self,
                 input_size,
                 hidden_layers = [500,500],
                 dropout = 0.7,
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
   
    def forward(self,xin):
        x = self.normalize(xin)
        x = self.input_dropout(x)
        for layer in self.layers:
            x = layer(x)
#         x = self.batchnorm(x)
        x = self.dropout(x)
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
            scale = xin[:,-1].view(-1,1)
            x_pd= torch.mul(x_pd,scale)
            x_nd= torch.mul(x_nd,scale)
            #shrink all but "no modifications"
#             x_mod[:,1:]  = torx_mod[:,1:] *scale
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
      
        
    def forward(self,x):
        x = self.normalize(x)
        x = self.input_dropout(x)
        for layer in self.layers:
            x = layer(x)
#         x = self.batchnorm(x)
        x = self.dropout(x)
        x= self.outcome_layer(x)
        x = self.sigmoid(x)
        return x
    
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
    
    def average(self,xlist,from_ll=True):
        if from_ll:
            xlist = [torch.exp(xx) for xx in xlist]
        if len(xlist) < 2:
            return xlist[0]
        else:
            return torch.stack(xlist).mean(dim=0) 
        
    def quantile(self,xlist,q,from_ll=True):
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
        xpd = self.average(xpd,from_ll=True)
        xnd = self.average(xnd,from_ll=True)
        xmod = self.average(xmod,from_ll=True)
        xdlt = self.average(xdlt,from_ll=False)
        
        xpd_range = self.cf(xpd_range,from_ll=True)
        xnd_range =self.cf(xnd_range,from_ll=True)
        xmod_range = self.cf(xmod_range,from_ll=True)
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

class DecisionModel(SimulatorBase):
    
    def __init__(self,
                 baseline_input_size,#number of baseline features used
                 hidden_layers = [100],
                 dropout = 0.5,
                 input_dropout=0.1,
                 state = 1,
                 eps = 0.01,
                 ):
        #input will be all states up until treatment 3
        input_size = baseline_input_size  + 2*len(Const.dlt1) + len(Const.primary_disease_states)  + len(Const.nodal_disease_states)  + len(Const.ccs)  + len(Const.modifications) + 2
    
        super().__init__(input_size,hidden_layers=hidden_layers,dropout=dropout,input_dropout=input_dropout,eps=eps,state='decisions')
        self.final_layer = torch.nn.Linear(hidden_layers[-1],len(Const.decisions)*2)
        self.baseline_input_size= baseline_input_size
        self.input_sizes = {
            'baseline': baseline_input_size,
            'dlt': len(Const.dlt1),
            'pd': len(Const.primary_disease_states),
            'nd': len(Const.nodal_disease_states),
            'cc': len(Const.ccs),
            'modifications': len(Const.modifications),
        }

#         self.final_layer = torch.nn.Linear(hidden_layers[-1],1)
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
    
    def get_embedding(self,x,position=0):
        xbase = x[:,0:self.baseline_input_size]
        xx = x[:,self.baseline_input_size:]
        xbase = self.normalize(xbase)
        x = torch.cat([xbase,xx],dim=1)
        x = self.add_position_token(x,position)
        for layer in self.layers:
            x = layer(x)
        return x
    
    def forward(self,x,position=0):
        x = x.to(self.get_device())
        x = self.get_embedding(x,position=position)
        x = self.dropout(x)
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
    
    def get_embedding(self,x,position=0,memory=None,use_saved_memory=False):
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
    
    def get_attributions(self,x,output=-1,target=0,**kwargs):
        device= self.get_device()
        x = x.to(device)
        if output == -1:
            model = lambda x: self.forward(x,**kwargs)
        else:
            model = lambda x: self.forward(x,**kwargs)[output]
        ig = IntegratedGradients(model)
        base = torch.zeros(x.shape).to(device)
        if self.memory is not None:
            if self.memory.ndim < 3:
                m = self.memory
            else:
                pos = kwargs.get('position',2)
                m = self.memory[pos]
            m = m.to(device)
            base[:] = torch.median(m,dim=0)[0].type(torch.FloatTensor)
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
        x_pd = self.disease_layer(x)
        x_nd = self.nodal_disease_layer(x)
        x_mod = self.treatment_layer(x)
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
