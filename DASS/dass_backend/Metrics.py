import numpy as np
from abc import ABC, abstractmethod
from scipy.stats import wasserstein_distance, chi2_contingency, fisher_exact
# from dtaidistance import dtw_ndim, dtw
from scipy.spatial.distance import cosine

class VectorizedSimilarity(ABC):
    
    def __init__(self, update=False,aggregate = 'average',skip_na=True,regularize=True,use_derivative = False):
        aggregate = aggregate.lower()
        if aggregate not in ['average','max','min','median','mode']:
            print('error: invalid aggregation in  similarity',aggregate)
        self.aggregate = aggregate
        self.regularize= regularize
        self.skip_na = skip_na
        self.update = update
        self.use_derivative=use_derivative
        
    def get_delta(self,x):
        curr = 0
        vals = []
        for xx in x:
            vals.append(xx - curr)
            curr = xx
        return np.array(vals).astype('float')
    
    @abstractmethod
    def sim_1d(self, x, y,weights=None):
        pass
    
    def sim_2d(self,x,y,weights=None):
        #assumes you want to 
        sims = []
        assert(x.shape == y.shape)
        for i in np.arange(x.shape[0]):
            xx = x[0]
            yy = y[0]
            if self.use_derivative:
                xx = self.get_delta(xx)
                yy = self.get_delta(yy)
            sim = self.sim_1d(xx,yy,weights=weights)
            #skip if any values are nan
            if self.skip_na and np.isnan(sim):
                continue
            sims.append(sim)
        sims = np.array(sims)
        return self.aggregate_sims(np.array(sims),weights=weights)
    
    def get_similarity_matrix(self,x,weights=None):
        x = x.astype('float')
        n = x.shape[0]
        sims = np.zeros((n,n))
        for i in np.arange(n):
            x1 = x[i]
            for ii in np.arange(i+1,n):
                x2 = x[ii]
                if x.ndim == 2:
                    sim = self.sim_1d(x1,x2)
                else:
                    sim = self.sim_2d(x1,x2,weights=weights)
                sims[i,ii] = sim
            if self.update:
                print('patient',i,'of',n,end='\r')
#             print(i,np.nanmean(sims[i,i:n]),np.nanstd(sims[i,i:n]))
        sims += sims.transpose()
        np.fill_diagonal(sims,self.sim_2d(x[0],x[0]))
        if self.regularize:
#             print(sims.min(),sims.max())
            sims = (sims - sims.min())/(sims.max()-sims.min())
        return sims
    
    def aggregate_sims(self,sims,weights=None):
        if weights is None:
            weights = np.array([1 for i in sims])
        if len(sims) < 1:
            return 0
        else:
            weights = np.array(weights)
        if self.aggregate == 'average':
            return np.nanmean(sims)
            mean = (sims*weights).sum()/weights.sum()
            return mean
        if self.aggregate == 'max':
            return sims.max()
        if self.aggregate == 'min':
            return sims.min()
        if self.aggregate == 'median':
            return sims.median()
        if self.aggregate == 'mode':
            return sims.mode()
        
class Euclidean2D(VectorizedSimilarity):
    
    def sim_1d(self,x,y,weights=None):
        x = np.array(x)
        y = np.array(y)
        if np.isnan(x).any() or np.isnan(y).any():
            return np.nan
        d = float(np.abs(np.sqrt(((x - y)**2).sum())))
        sim = 1/(1+d)
        return sim
    
class Wasserstein2d(VectorizedSimilarity):
    
    def __init__(self,steps=None, **kwargs):
        super().__init__(**kwargs)
        self.steps = steps
    
    def sim_1d(self,x,y,weights=None):
        if weights is None and self.steps is not None:
            weights = self.steps
            assert(len(self.steps) == len(x))
        d = wasserstein_distance(x,y,weights,weights)
        return 1/(1+d)
    
# class DTWi2d(VectorizedSimilarity):
            
#     def __init__(self, 
#                  window=None, 
#                  max_dist=None, 
#                  max_step=None,
#                  prune=False,
#                  **kwargs):
#         super().__init__(**kwargs)
#         self.window=window
#         self.max_dist=max_dist
#         self.max_step = max_step
#         self.prune=prune
        
#     def sim_1d(self,x,y,weights=None):
#         x = x.ravel()
#         y = y.ravel()
#         d = dtw.distance_fast(x,y,
#                                  window=self.window,
#                                  max_dist=self.max_dist,
#                                  max_step=self.max_step,
#                                  use_pruning=self.prune,
#                                 )
#         return 1/(1+d)
   
    
    
# class DTWd2d(VectorizedSimilarity):
    
#     def __init__(self, 
#                  window=None, 
#                  max_dist=None, 
#                  max_step=None,
#                  prune=False,
#                  **kwargs):
#         super().__init__(**kwargs)
#         self.window=window
#         self.max_dist=max_dist
#         self.max_step = max_step
#         self.prune=prune
#         if self.aggregate != 'average':
#             print('DTWd2d doesnt handle different aggregation, try DTWi2d (independent)')
    
#     def sim_2d(self,x,y,weights=None):
#         d = dtw_ndim.distance_fast(x,y,
#                                  window=self.window,
#                                  max_dist=self.max_dist,
#                                  max_step=self.max_step,
#                                  use_pruning=self.prune,
#                                 )
#         return 1/(1+d)
    
#     def sim_1d(self,x,y,weights=None):
#         print('DTWd2d shouldnt be calling sim_1d but it is')

class Jaccard2d(VectorizedSimilarity):
    
    def sim_1d(self,x,y,weights=None):
        d = jaccard_distance(x,y)
        return 1/(1+d)
    
class Cosine2d(VectorizedSimilarity):
    
    def sim_1d(self,x,y,weights=None):
        sim = cosine(x.ravel(),y.ravel())
        return sim
    
class ChiSquared2d(VectorizedSimilarity):
    
    def sim_1d(self,x,y,weights=None):
        d = chi_squared_distance(x,y)
        return 1/(1+d)
    
def local_tssim(x,y,v = None, w = None):
    #calculates local similarity within two numpy arrays
    #ignores structure of the windows
    #x, y are base variables (distances) for patients 1 and 2
    #v and w are volumes for patients 1 and 2
    #should all be 1-dimensional for original intended use
    c1 = .000001
    c2  = .000001
    x = x
    y = y
    mean_x = np.mean(x)
    mean_y = np.mean(y)
    covariance = np.cov(x,y)
    numerator = (2*mean_x*mean_y + c1) * (covariance[0,1] + covariance[1,0] + c2)
    denominator = (mean_x**2 + mean_y**2 + c1)*(np.var(x) + np.var(y) + c2)
    if v is not None and w is not None:
        mean_v = np.mean(v)
        mean_w = np.mean(w)
        numerator *= (2*mean_v*mean_w + c1)
        denominator *= (mean_v**2 + mean_w**2 + c1)
    if denominator > 0:
        return numerator/denominator
    else:
        print('error, zero denomiator in ssim function')
        return 0
    
def jaccard_distance(x, y):
    x = x.ravel()
    y = y.ravel()
    numerator = x.dot(y)
    denominator = x.dot(x) + y.dot(y) - x.dot(y)
    if numerator == 0 or denominator == 0:
        return 0
    return numerator/denominator

def chi_squared_distance(x,y):
    #exp(-gamma Sum [(x - y)^2 / (x + y)])
    eps = .000001
    d = ((x-y)**2/(x+y+eps)).sum()
    return d/5

def masked_mse(true,pred,normalize=True):
    y = np.ma.masked_invalid(true)
    baseline = np.copy(y)**2
    diff = ((y - pred)**2)
    while diff.data.ndim > 1:
        diff = diff.sum(axis=-1)
        baseline = np.nansum(baseline,axis=-1)
    diff = diff
    diff = np.sqrt(diff)
    baseline = np.sqrt(baseline)
    if normalize:
        diff = diff/baseline
    return diff.data.mean()

def masked_mae(true,pred,normalize=True):
    y = np.ma.masked_invalid(true)
    baseline = np.abs(np.copy(y))
    diff = np.abs(y - pred)
    while diff.data.ndim > 1:
        diff = np.nansum(diff,axis=-1)
        baseline = np.nansum(baseline,axis=-1)
    diff = diff
    baseline = baseline
    if normalize:
        diff = diff/baseline
    return diff.data.mean()

def contingency(v1,v2):
    n_v1 = len(np.unique(v1))
    n_v2 = len(np.unique(v2))
    table = np.zeros((n_v1,n_v2))
    for i, vv1 in enumerate(np.unique(v1)):
        for ii,vv2 in enumerate(np.unique(v2)):
            in_cell = (v1 == vv1) & (v2 == vv2)
            table[i,ii] = in_cell.sum()
    return table

def boolean_fisher_exact(v1,v2):
    ctable = contingency(v1,v2)
    return fisher_exact(ctable)

def vector_chi2(x,y):
    x = x.ravel()
    y = y.ravel()
    ctable = contingency(x,y)
    res = chi2_contingency(ctable)
    return res[0], res[1]