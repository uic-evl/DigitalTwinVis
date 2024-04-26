import pandas as pd
import numpy as np
from Constants import Const
import json
import Utils
import re

from sklearn.ensemble import AdaBoostClassifier, AdaBoostRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.mixture import GaussianMixture, BayesianGaussianMixture
from sklearn.cluster import SpectralClustering, KMeans, AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.metrics import roc_auc_score, f1_score, recall_score, precision_score, precision_recall_fscore_support, matthews_corrcoef

from scipy.stats import chi2
from sklearn.feature_selection import mutual_info_regression, mutual_info_classif
from ast import literal_eval
import statsmodels.api as sm
import Metrics

import joblib
import warnings
from statsmodels.tools.sm_exceptions import ConvergenceWarning, HessianInversionWarning
warnings.simplefilter('ignore', ConvergenceWarning)
warnings.simplefilter('ignore', HessianInversionWarning)

def add_sd_dose_clusters(sddf, 
                         clusterer = None,
                         features=None,
                         reducer=None,
                         organ_subset=None,
                         normalize = True,
                         prefix='',
                         n_clusters = 4,
                        ):
    if clusterer is None:
        clusterer = BayesianGaussianMixture(n_init=5,
                                            n_components=n_clusters, 
                                            covariance_type="full",
                                            random_state=100)
    if features is None:
        features=['V35','V40','V45','V50','V55','V60','V65']
    if reducer is None:
        reducer= None#PCA(len(organ_list),whiten=True)
    if organ_subset is None:
        organ_subset = Const.organ_list[:]
    organ_positions = [Const.organ_list.index(o) for o in organ_subset]
    vals = np.stack(sddf[features].apply(lambda x: np.stack([np.array([ii[i] for i in organ_positions]).astype(float) for ii in x]).ravel(),axis=1).values)
    if normalize:
        vals = (vals - vals.mean(axis=0))/(vals.std(axis=0) + .01)
    if reducer is not None:
        vals = reducer.fit_transform(vals)
    df = pd.DataFrame(vals,index = sddf.index)
    clusters = clusterer.fit_predict(vals)
    new_df = sddf.copy()
    cname= prefix+'dose_clusters'
    new_df[cname] = clusters
    new_df = reorder_clusters(new_df,
                              cname,
                              by='mean_dose',
                              organ_list=organ_subset#order by mean dose to clustered organs
                             )
    return new_df

def reorder_clusters(df,cname,by='moderate_6wk_symptoms',organ_list=None):
    df = df.copy()
    df2 = df.copy()
    severities = {}
    clusts = sorted(df[cname].unique())
    getmean = lambda d: d[by].astype(float).mean()
    if organ_list is not None and Utils.iterable(df[by].iloc[0]):
        keep_idx = [Const.organ_list.index(o) for o in organ_list]
        df[by] = df[by].apply(lambda x: [x[i] for i in keep_idx])
    if Utils.iterable(df[by].iloc[0]):
        getmean = lambda d: np.stack(d[by].apply(lambda x: np.array(x).sum()).values).mean()
    for c in clusts:
        subset = df[df[cname] == c]
        avg_severity = getmean(subset)
        severities[c] = avg_severity
    clust_order = np.argsort(sorted(severities.keys(), key = lambda x: severities[x]))
    clust_map = {c: clust_order[i] for i,c in enumerate(clusts)}
    df2[cname] = df[cname].apply(lambda x: clust_map.get(x))
    return df2

def get_df_dose_cols(df,key='DV'):
    return [c for c in df.columns if re.match('[' + key + ']\d+',c) is not None]

def get_df_symptom_cols(df):
    return [c for c in df.columns if 'symptoms_' in c if 'original' not in c]
    
def add_symptom_groups(df):
    smap = {
        'salivary': ['drymouth','taste'],
        'throat':['swallow','choke','teeth','sob','mucositis'],
        'mouth':['drymouth','teeth','swallow'],
        'core': ['pain','fatigue','nausea','sleep',
                 "distress", "sob", "memory", "appetite", 
                "drowsy", "drymouth", "sad", "vomit", "numb"],
        'interference': ["activity", "mood", "work", 
                "relations", "walking","enjoy"],
        'hnc': ["mucus", "swallow", "choke", "voice", "skin", 
                "constipation", "taste", "mucositis", "teeth"],
    }
    df = df.copy()
    for name, symptoms in smap.items():
        array = []
        for s in symptoms:
            svals = np.stack(df['symptoms_'+s].apply(lambda x: np.array(x)).values)
            array.append(svals)
        array = np.stack(array,axis=-1)
        #rounding in the same weird way you do in microprocessor code
        smean = (100*array.mean(axis=-1)).astype('int')/100.0
        smax = array.max(axis=-1)
        df['symptoms_'+name+'_max'] = smax.tolist()
        df['symptoms_'+name+'_mean'] = smean.tolist()
    return df
    
def add_confounder_dose_limits(df,organ_list=None):
    #dose limits as binary values from https://applications.emro.who.int/imemrf/Rep_Radiother_Oncol/Rep_Radiother_Oncol_2013_1_1_35_48.pdf
    #not inlcudeing other stuff like eyes at this time
    #also, my max dose is weird so I'm using V10 for that because I feel like that makes sense
    #using the 
    if organ_list is None:
        organ_list = Const.organ_list[:]
    df = df.copy()
    original_cols = set(df.columns)
    getval = lambda organ,param: df[param].apply(lambda x: x[organ_list.index(organ)])
    get_lr_val = lambda organ,param: np.maximum(getval('Lt_'+organ,param),getval('Rt_'+organ,param))
    
    maxdose_var = 'max_dose'
   
    #xerostomia. >25 for 1 or >20 for both
    df['Parotid_Gland_limit'] = (get_lr_val('Parotid_Gland','mean_dose') > 20) | (getval('Lt_Parotid_Gland','mean_dose') > 25) | (getval('Rt_Parotid_Gland','mean_dose') > 25)
    
    #there is 50 for PEG tube and 60 for aspiration so i'll do 50
    for o in ['IPC','MPC',"SPC"]:
        df[o+"_limit"] = getval(o,'mean_dose') > 50
        df[o+"_limit2"] = getval(o,'mean_dose') > 60
    
    #edema
    df['Larynx_limit'] = getval('Larynx','V50') > 27
    
    #Esophagitus
    elimits = [('V35',50),('V50',40),('V70',20),('V60',30)]
    df['Esophagus_limit'] = np.stack([(getval('Esophagus',v) > lim) for v,lim in elimits]).sum(axis=0) > 0
    return df

def add_total_doses(df,cols):
    df = df.copy()
    for col in cols:
        if col in df.columns:
            df['total_'+col] = df[col].apply(np.sum)
    return df

def load_dose_symptom_data(use_lstm=False,file= None):
    if file is not None:
        data = pd.read_csv(Const.data_dir + file)
    else:
        if use_lstm:
            data = pd.read_csv(Const.data_dir + 'lstm_dose_symptoms_merged.csv')
        else:
            data = pd.read_csv(Const.data_dir + 'dose_symptoms_merged.csv')
    to_drop = [c for c in data.columns if 'symptom' in c and ('symptoms_' not in c or 'original' in c)]
    data = data.drop(to_drop,axis=1)
    dose_cols = get_df_dose_cols(data)
    s_cols = get_df_symptom_cols(data) 
    for c in dose_cols + s_cols + ['max_dose','mean_dose','volume','dates']:
        try:
            data[c] = data[c].apply(literal_eval)
        except Exception as e:
            print(c,e)
    data = add_symptom_groups(data)
    data = add_total_doses(data,['mean_dose'])
    data = add_confounder_dose_limits(data)
    return data


def var_test(df, testcol, ycol,xcols, 
             regularize = False,
             scale=True):
    df = df.fillna(0)
    y = df[ycol]
    if testcol not in xcols:
        xcols = xcols + [testcol]
    x = df[xcols].astype(float)
    if regularize:
        for col in xcols:
            x[col] = (x[col] - x[col].mean())/(x[col].std()+ .001)
    if scale:
        for col in xcols:
            x[col] = (x[col] - x[col].min())/(x[col].max() - x[col].min())
    for col in xcols:
        if x[col].std() < .00001:
            x = x.drop(col,axis=1)
    x2 = x.copy()
    x2 = x2.drop(testcol,axis=1)
    boolean = (y.max() <= 1) and (len(y.unique()) <= 2)
    if boolean:
        model = sm.Logit
        method = 'bfgs'
    else:
        model = sm.OLS
        method= 'qr'
    logit = model(y,x)
    logit_res = logit.fit(maxiter=500,
                          disp=False,
                          method=method,
                         )
    
    logit2 = model(y,x2)
    logit2_res = logit2.fit(maxiter=500,
                            disp=False,
                            method=method,
                           )
    
    llr_stat = 2*(logit_res.llf - logit2_res.llf)
    llr_p_val = chi2.sf(llr_stat,1)
    
    aic_diff = logit_res.aic - logit2_res.aic
    bic_diff = logit_res.bic - logit2_res.bic
    odds = np.exp(logit_res.params)
    results = {
        'ttest_pval': logit_res.pvalues[testcol],
        'ttest_tval': logit_res.tvalues[testcol],
        'lrt_pval': llr_p_val,
        'aic_diff': aic_diff,
        'bic_diff': bic_diff,
        'odds_ratio': odds[testcol]
    }
    return results
def get_cluster_lrt(df,clust_key = 'dose_clusters',
                             symptoms=None,
                             nWeekList = None,
                             confounders=None,
                             thresholds=None,
                            ):
    #add tests for pvalues for data
    # print('cluster lrt',symptoms)
    if symptoms is None:
        symptoms = Const.symptoms[:]
    if nWeekList is None:
        nWeekList = [[13],[33]]
    if confounders is None:
        confounders = [
            't4',
            'n3',
            'hpv',
            'BOT',
            'Tonsil',
            'total_mean_dose',
           #'Larynx_limit',
           #'Parotid_Gland_limit'
                      ]
    if thresholds is None:
        thresholds = [-5,-1,0,5]
    
    
    tdose_cols = [c.replace('total_','') for c in confounders if ('total_' in c)]
    if len(tdose_cols) > 0:
        print('tdose cols',tdose_cols)
        df = add_total_doses(df,tdose_cols)
    for nWeeks in nWeekList:
        date_keys = [df.dates.iloc[0].index(week) for week in nWeeks if week in df.dates.iloc[0]]
        #calculate change from baseline instead of absolute
        get_symptom_max = lambda x: np.max([x[d] for d in date_keys])
        get_symptom_change_max = lambda x: np.max([x[d]-x[0] for d in date_keys])
        for symptom in symptoms:
            skey = 'symptoms_'+symptom
            if skey not in df.columns:
                continue
            
            for threshold in thresholds:
                colname=  'cluster_'+symptom
                boolean = threshold not in [0,-1]
                use_change = threshold < 0
                if use_change:
                    max_symptoms = df[skey].apply(get_symptom_max).values
                    colname += '_change'
                else:
                    max_symptoms = df[skey].apply(get_symptom_change_max).values
                if boolean:
                    y = max_symptoms >= np.abs(threshold)
                    colname += '_'+str(np.abs(threshold))
                    colname += '_' + ''.join([str(w) for w in nWeeks]) + 'wks'
                else:
                    y = max_symptoms
                names = ['lrt_pval','ttest_tval','ttest_pval','aic_diff','odds_ratio']
                for n in names:
                    df[colname+'_'+n] = -1
                for clust in df[clust_key].unique():
                    in_clust = df[clust_key] == clust
                    if len(np.unique(y)) < 2:
                        continue
                    else:
                        df['x'] = in_clust
                        df['y'] = y
                        res = var_test(df,'x','y',confounders)
                        for name in names:
                            if not pd.isnull(res[name]):
                                df.loc[df[in_clust].index,[colname+'_'+name]] = res[name]
                    
    return df
    
def get_cluster_correlations(df,clust_key = 'dose_clusters',
                             symptoms=None,
                             nWeekList = None,
                             thresholds=None,
                             baselines=[False],
                            ):
    #add tests for pvalues for data
    if symptoms is None:
        symptoms = Const.symptoms[:]
    if nWeekList is None:
        nWeekList = [[13],[33]]
    if thresholds is None:
        thresholds = [5]
    df = df.copy()
    for nWeeks in nWeekList:
        date_keys = [df.dates.iloc[0].index(week) for week in nWeeks if week in df.dates.iloc[0]]
        #calculate change from baseline instead of absolute
        get_symptom_change_max = lambda x: np.max([x[d]-x[0] for d in date_keys])
        get_symptom_max = lambda x: np.max([x[d] for d in date_keys])
        for symptom in symptoms:
            skey = 'symptoms_'+symptom
            if skey not in df.columns:
                continue
            max_symptoms = df[skey].apply(get_symptom_max).values
            max_change = df[skey].apply(get_symptom_change_max).values
            for threshold in thresholds:
                for baseline in baselines:
                    if baseline:
                        y = (max_change >= threshold).astype(int)
                    else:
                        y = (max_symptoms >= threshold).astype(int)
                    colname=  'cluster_'+symptom
                    if baseline:
                        colname += '_change'
                    colname += "_" + str(threshold)
                    colname += '_' + ''.join([str(w) for w in nWeeks]) + 'wks'
                    df[colname+'_fisher_odds_ratio'] = -1
                    df[colname+'_fisher_pval'] = -1
                    for clust in df[clust_key].unique():
                        in_clust = df[clust_key] == clust
                        if len(np.unique(y)) < 2:
                            (odds_ratio,pval) = (0,1)
                        else:
                            (odds_ratio, pval) = Metrics.boolean_fisher_exact(in_clust.astype(int),y)
                        df.loc[df[in_clust].index,[colname+'_fisher_odds_ratio']] = odds_ratio
                        df.loc[df[in_clust].index,[colname+'_fisher_pval']] = pval
    return df

def keyword_clusterer(cluster_type, n_clusters,**kwargs):
    clusterer = None
    if cluster_type.lower() == 'bgmm':
        clusterer = BayesianGaussianMixture(n_init=5,
                                            n_components=n_clusters, 
                                            covariance_type="full",
                                            random_state=100)
    if cluster_type.lower() == 'gmm':
        clusterer = GaussianMixture(n_init=5,
                                    n_components=n_clusters, 
                                    covariance_type="full",
                                    random_state=100)
    if cluster_type.lower() == 'spectral':
        clusterer = SpectralClustering(n_clusters=n_clusters)
    if cluster_type.lower() == 'kmeans':
        clusterer = KMeans(n_clusters=n_clusters,max_iter=1000)
    if cluster_type.lower() == 'ward':
        clusterer = AgglomerativeClustering(n_clusters=n_clusters,
                                            linkage='ward')
    if clusterer is None:
        print('bad cluster argument', cluster_type,'using kmeans')
        clusterer = KMeans(n_clusters=n_clusters,max_iter=1000)
    return clusterer

def get_cluster_json(df,
                     organ_list=None,
                     quantiles = None,
                     sdates = [13,33],
                     other_values = None,
                    #  add_metrics=True,
                     add_metrics = False,
                     update_clusters=True,
                     clustertype = None,
                     confounders=None,
                     n_clusters = 4,
                     thresholds=[3,5,7],
                     symptoms=None,
                     **kwargs):
    if organ_list is None:
        organ_list = Const.organ_list[:]
    clusterer = None
    if clustertype is not None:
        clusterer = keyword_clusterer(clustertype,n_clusters)
    if update_clusters or ('dose_clusters' not in df.columns):
        df = add_sd_dose_clusters(df.copy(),
                                  organ_subset = organ_list,
                                  clusterer=clusterer,
                                  n_clusters = n_clusters,
                                  **kwargs)
    else:
        print('skipping stuff')
    clust_dfs = []
    dose_cols = get_df_dose_cols(df,key='V') + ['mean_dose','volume']
    s_cols = get_df_symptom_cols(df)
    if quantiles is None:
        quantiles = np.linspace(.1,.9,6) 
    dates = df.dates.iloc[0]
#     date_positions = [(sdate, dates.index(sdate)) for sdate in sdates if sdate in dates]
    #i'm asuming these are discrete
    if other_values is None:
        other_values = [
            'subsite',
            'n_stage','t_stage',
            'os',
            'age',
            'hpv',
            'is_male',
            'chemotherapy','concurrent','ic','rt',
            'digest_increase'
        ]
    #adds in pvalues and odds ratio
    stats_cols=[]
    if add_metrics:
        old_cols = df.columns
        dates = [[13],[33]]
        if len(sdates) > 1 or sdates[0] not in [i[0] for i in dates]:
            dates.append(sdates)
        if confounders is None or len(confounders) < 1:
            df = get_cluster_correlations(df,
                                          thresholds=thresholds,
                                          clust_key='dose_clusters',
                                          baselines=[False],
                                          symptoms=symptoms,
                                          nWeekList=dates)
        else:
            df = get_cluster_lrt(df,
                                  clust_key='dose_clusters',
                                  confounders=confounders,
                                  symptoms=symptoms,
                                  nWeekList=dates)
        stats_cols =sorted(set(df.columns) - set(old_cols))
    df = df.reset_index()
    for c,subdf in df.groupby('dose_clusters'):
        clust_entry = {
            'cluster_size': subdf.shape[0],
            'dates':dates,
            'ids': subdf.id.values.tolist(),
            'clusterId': c,
            }
        
        for organ in Const.organ_list:
            opos = Const.organ_list.index(organ)
            for dcol in dose_cols:
                vals = subdf[dcol].apply(lambda x: x[opos])
                qvals = vals.quantile(quantiles)
                clust_entry[organ+'_'+dcol] = qvals.values.astype(float).tolist()
            
        for scol in s_cols:
            sname = scol.replace('symptoms_','')
            clust_entry[sname] = subdf[scol].apply(lambda x: [int(i) for i in x]).values.tolist()
        for col in other_values:
            clust_entry[col] = subdf[col].values.tolist()
        for statcol in stats_cols:
            val = subdf[statcol].iloc[0]
            clust_entry[statcol] = val
        clust_dfs.append(clust_entry)
    return clust_dfs


def add_dose_pca(df, features,organs=None,n_dims=3):
    df = df.copy()
    if organs is not None:
        oidx = [Const.organ_list.index(i) for i in organs if i in Const.organ_list]
        for f in features:
            df[f] = df[f].apply(lambda x: [x[i] for i in oidx])
            df = df.copy()
    dose_x = np.stack(df[features].apply(lambda x: np.stack(x).ravel(),axis=1).values)
    n_dims = min(n_dims,dose_x.shape[1])
    dose_x_pca = PCA(n_dims).fit_transform(dose_x)
    return [x.tolist() for x in dose_x_pca]
    
def pca_json(df, features=None,organs=None,**kwargs):
    if features is None:
        features = ['mean_dose']
    if organs is None:
        organs = Const.organ_list[:]
    pca = add_dose_pca(df.copy(),features,organs=organs,**kwargs)
    res = pd.DataFrame(pca,index=df.index)
    res.index.name = 'id'
    return res.reset_index().to_dict(orient='records')



def sddf_to_json(df,
                 to_drop =None,
                 add_pca = True,
                 pca_organs=None,
                 dose_pca_features = None,
                ):
    if to_drop is None:
        to_drop = ['min_dose','is_ajcc_8th_edition']
    df = df.copy().fillna(0)
    df['totalDose'] = df['mean_dose'].apply(np.sum)
    df['organList'] = [Const.organ_list[:] for i in range(df.shape[0])]
    if add_pca:
        if dose_pca_features is None:
            dose_pca_features = ['V35','V40','V45','V50','V55','V60','V65']
        df =df.copy() #fragmentation issues
        df['dose_pca'] = add_dose_pca(df,dose_pca_features) 
        if pca_organs is not None and len(pca_organs)*len(dose_pca_features) > 3:
            df['cluster_organ_pca'] = add_dose_pca(df,dose_pca_features,pca_organs,3)
        
        symptom_cols = [c for c in df.columns if 'symptoms_' in c and 'original' not in c] 
        valid_sd = [i for i,date in enumerate(df.dates.iloc[0]) if date <= 33]
        late_sd = [i for i,date in enumerate(df.dates.iloc[0]) if date <= 33 and date > 7]
        treatment_sd = [i for i,date in enumerate(df.dates.iloc[0]) if date <= 7]
        for name, pos_list in zip(['all','post','treatment'],[valid_sd,late_sd,treatment_sd]):
            symptom_x = np.stack(df[symptom_cols].apply(lambda x: np.stack([x[i] for i in pos_list]).ravel(),axis=1).values)
            symptom_x_pca = PCA(3).fit_transform(symptom_x)
            df['symptom_'+name+'_pca'] = [x.tolist() for x in symptom_x_pca]
        df = df.copy() #fragmentation issues
    is_dose_dvh = lambda x: re.match('D[0-9][0-9]?',x) is not None
    vol_dvh_too_high = lambda x: re.match('V[08-9][0-9]?',x) is not None
    for c in df.columns:
        if is_dose_dvh(c) or vol_dvh_too_high(c):
            to_drop.append(c)
        if 'symptoms' in c and 'original' in c:
            to_drop.append(c)
        if '_max_' in c:
            to_drop.append(c)
    df = df.drop(to_drop,axis=1)
    ddict = df.reset_index().to_dict(orient='records')
    return ddict


def add_late_symptoms(df,symptoms=None,dates=None):
    df = df.copy()
    if dates is None:
        dates = [13,33]
    if symptoms is None:
        symptoms = Const.symptoms[:]
    date_idxs = [i for i,v in enumerate(df.dates.iloc[0]) if v in dates]
    for symptom in symptoms:
        mval = df['symptoms_'+symptom].apply(lambda x: np.max([x[i] for i in date_idxs]))
        df[symptom+'_late'] = mval
    return df


def multi_var_tests(df, testcols, ycol,xcols, 
             boolean=True,
             regularize = False,
             scale=True):
    y = df[ycol]
    xcols = list(set(xcols).union(set(testcols)))
    x = df[xcols].astype(float)
    if regularize:
        for col in xcols:
            x[col] = (x[col] - x[col].mean())/(x[col].std()+ .01)
    if scale:
        for col in xcols:
            x[col] = (x[col] - x[col].min())/(x[col].max() - x[col].min())
    for col in xcols:
        if x[col].std() < .00001:
            x = x.drop(col,axis=1)
    x2 = x.copy()
    x2 = x2.drop(testcols,axis=1)
    if boolean:
        model = sm.Logit
        method = 'bfgs'
    else:
        model = sm.OLS
        method= 'qr'
    logit = model(y,x)
    logit_res = logit.fit(maxiter=500,
                          disp=False,
                          method=method,
                         )
    
    logit2 = model(y,x2)
    logit2_res = logit2.fit(maxiter=500,
                            disp=False,
                            method=method,
                           )
    
    llr_stat = 2*(logit_res.llf - logit2_res.llf)
    llr_p_val = chi2.sf(llr_stat,len(testcols))
    
    aic_diff = logit_res.aic - logit2_res.aic
    bic_diff = logit_res.bic - logit2_res.bic
    odds = np.exp(logit_res.params)
    results = {
        'lrt_pval': llr_p_val,
        'aic_diff': aic_diff,
        'bic_diff': bic_diff
    }
    for testcol in testcols:
        results['ttest_pval_' + str(testcol)]= logit_res.pvalues[testcol]
        results['ttest_tval_' + str(testcol)]= logit_res.tvalues[testcol]
        results['odds_ratio_' + str(testcol)]= odds[testcol]
    return results

def dvh_num(string,key='V'):
    if string == 'mean_dose':
        return 99
    if string == 'max_dose':
        return 100
    match = re.match(key+"(\d+).*",string)
    if match is not None:
        return int(match.groups()[0])
    return 0

def downstep_dvh_window(df,base,key='V',fixed_size=True,minVal = 5):
    lower = max(base[0]-5,minVal)
    
    while lower > minVal and key+str(int(lower)) not in df.columns:
        lower -= 5
    lwindow = [lower] + [v for v in base if v != base[-1]]    
    if not fixed_size:
        lwindow.append(base[-1])
    return sorted(set(lwindow))

def upstep_dvh_window(df,base,key='V',fixed_size=True,maxVal=80):
    upper = min(base[-1]+5,maxVal)
    
    while upper < maxVal and key+str(int(upper)) not in df.columns:
        lower += 5
    if fixed_size:
        uwindow = base[1:] + [upper]    
    else:
        uwindow = base[:] + [upper]
    return sorted(set(uwindow))
        
def get_dvh_windows(df, base_window, key='V',n_steps = 1, **kwargs):
    base = sorted([dvh_num(x,key=key) for x in base_window if dvh_num(x) != 0 and x in df.columns])
    windows = [base]
    lbase = base[:]
    ubase = base[:]
    for i in range(n_steps):
        if len(lbase) > 1:
            lbase = downstep_dvh_window(df,lbase,**kwargs)
            windows = [lbase] + windows
        if len(ubase) > 1:
            ubase = upstep_dvh_window(df,ubase,**kwargs)
            windows = windows + [ubase]
    windows = [[key+str(int(v)) for v in wndw] for wndw in windows]
    return windows

def get_all_dvh(df,key='V'):
    vcols = [col for col in df.columns if col[0] == key and dvh_num(col,key=key) > 0]
    return sorted(vcols, key=dvh_num)

def select_single_organ_cluster_effects(df,
                                        symptom=None,
                                        base_organs=None,
                                        dates=None,
                                        covars=None,
                                        n_clusters=4,
                                        clustertype=None,
                                        thresholds=None,
                                        drop_base_cluster=True,
                                        features=None,
                                        clusters=None,
                                        dvh_steps = 0,
                                        organ_list=None):
    if base_organs is None:
        base_organs = []
    if thresholds is None:
        thresholds = [5]
    if clusters is None:
        clusters = [None,n_clusters-1]
    print('clusters',clusters)
    if organ_list is None:
        #imma just skip stuff that's like probably not relevant for this usage
        exclude = set(['Brainstem',"Spinal_Cord",
                   'Lt_Brachial_Plexus','Rt_Brachial_Plexus',
                #    'Lower_Lip',"Upper_Lip",
                   'Hyoid_bone','Mandible',
                   'Cricoid_cartilage',
                    'Thyroid_cartilage',
                  ])
        organ_list = [o for o in Const.organ_list if o not in exclude]
    if symptom is None:
        symptom = 'drymouth'

    df = add_late_symptoms(df,[symptom],dates=dates)
    df = add_confounder_dose_limits(df)
    
    if features is None:
        features = ['V40','V45','V50','V55']
    print('features',features)
    if dvh_steps > 0:
        fsets = get_dvh_windows(df,features,n_steps=dvh_steps)
    else:
        fsets = [features]
    olists = []
    for o in organ_list:
        if o in base_organs:
            new_list = [bo for bo in base_organs if bo != o]
            if len(new_list) > 0:
                olists.append(new_list)
        else:
            new_list = [o]
            if len(base_organs) > 0:
                new_list = new_list + base_organs
            if len(new_list) > len(base_organs):
                olists.append(new_list)
    if covars is None:
        covars = [
            'Parotid_Gland_limit',
          'IPC_limit','MPC_limit','SPC_limit',
          't4','n3','hpv','total_dose',
          "BOT","Tonsil",
         ]
    df = df.copy()
    df['total_dose'] = df.mean_dose.apply(lambda x: np.sum(x))
    
    clusterer = None
    if clustertype is not None:
        clusterer = keyword_clusterer(clustertype,n_clusters)
    
    dvh_options = get_all_dvh(df,key='V') + ['max_dose','mean_dose']
    alt_features = []
    fids = []
    for col in dvh_options:
        if col in features:
            fsubset = [c for c in features if c != col]
        else:
            fsubset = features + [col]
        alt_features.append(fsubset)
        fids.append(dvh_num(col))
    feature_results = []
    organ_results = []
    for cluster in clusters:
        for threshold in thresholds: 
            
            make_fargs = lambda f,i: (df,base_organs,base_organs,symptom,covars,cluster,f,i,clusterer,n_clusters,clustertype,threshold,drop_base_cluster,)
            flist = joblib.Parallel(n_jobs=-2)(joblib.delayed(parallel_cluster_lrt)(make_fargs(f,i)) for i,f in zip(fids,alt_features))
            base_fresults =parallel_cluster_lrt(make_fargs(features,0))
            for item in flist:
                for key in ['lrt_pval','aic_diff','bic_diff']:
                    item[key+'_base'] = base_fresults[key]
                feature_results.append(item)
                
            for fi,featureset in enumerate(fsets):
                make_args = lambda ol: (df,ol,base_organs,symptom,covars,cluster,featureset,(fi-dvh_steps),clusterer,n_clusters,clustertype,threshold,drop_base_cluster,)
                if len(base_organs) > 0:
                    base_results = parallel_cluster_lrt(make_args(base_organs))
                rlist = joblib.Parallel(n_jobs=-2)(joblib.delayed(parallel_cluster_lrt)(make_args(olist)) for olist in olists)
                for rl_item in rlist:
                    for key in ['lrt_pval','aic_diff','bic_diff']:
                        rl_item[key+'_base'] = base_results[key] 
                    organ_results.append(rl_item)
#     results= sorted(results,key=lambda x: x['bic_diff'])
    results = {'organ': organ_results,'features': feature_results}
    return results

def parallel_cluster_lrt(args):
    [df,olist,base_organs,symptom,covars,cluster,features,featureId,clusterer,n_clusters,clustertype,threshold,drop_base_cluster] = args
    prefix = '_'.join(olist)+'_'
    df  = add_sd_dose_clusters(
        df,
        features = features,
        organ_subset=olist,
        prefix=prefix,
        clusterer=clusterer,
        n_clusters=n_clusters,
    )
    clustname = prefix+'dose_clusters'
    
    if cluster is not None and cluster > 0:
        df['x'] = (df[clustname] == cluster).astype(int)
        xvals = ['x']
    else:
        xvals = []
        for cval in df[clustname].unique():
            if cval == 0 and drop_base_cluster:
                continue
            df['x'+str(cval)] = (df[clustname] == cval).astype(int)
            xvals.append('x'+str(cval))
        
    outcome = symptom + '_late'
    if threshold is None:
        df['y'] = df[outcome]
    else:
        df['y'] = (df[outcome] >= threshold)
    res = multi_var_tests(df,xvals,'y',covars,boolean=(threshold is not None))
    
    added = '-'.join(sorted(set(olist)-set(base_organs)))
    removed=False
    if len(added) <= 0:
        added = '-'.join(sorted(set(base_organs)-set(olist)))
        removed = True
    entry = {
        'symptom':symptom,
        'base_organs':'-'.join(base_organs),
        'added_organs':added,
        'removed': removed,
        'features':'-'.join(features) if features is not None else '',
        'featurePos': featureId,#should be the number of "steps" the feature window has slid to the right (-1 = V(x-5) for Vx in origina feature set)
        'threshold':threshold if threshold is not None else 0,
#         'clustertype':clustertype,
        'cluster': cluster if cluster is not None else -1,
    }
    for k,v in res.items():
        if 'ttest' not in k:
            entry[k] = v
    return entry


def get_sample_cluster_metrics_input():
    with open(Const.data_dir+'cluster_post_test.json','r') as f:
        post_data= simplejson.load(f)
    return post_data

def extract_dose_vals(df,organs,features,include_limits = False):
    oidxs = [Const.organ_list.index(o) for o in organs if o in Const.organ_list]
    df = df.copy()
    vals = []
    names = []
    for f in features:
        for (oname, oidx) in zip(organs,oidxs):
            values = df[f].apply(lambda x: x[oidx]).values
            vals.append(values.reshape((-1,1)))
            names.append(f+'_'+oname)
    vals = np.hstack(vals)
    vals = pd.DataFrame(vals,columns=names,index=df.index)
    if include_limits:
        limit_cols = [t for t in df.columns if '_limit' in t]
        for l in limit_cols:
            vals[l] = df[l].astype(int).fillna(0)
    return vals 

def get_outcomes(df,symptoms,dates,threshold=None):
    date_idxs = [i for i,d in enumerate(df.dates.iloc[0]) if d in dates]
    res = []
    get_max_sval = lambda s: df['symptoms_'+s].apply(lambda x: np.max([x[i] for i in date_idxs]) ).values
    res = {symp:get_max_sval(symp) for symp in symptoms}
    return pd.DataFrame(res,index=df.index)

def add_post_clusters(df,post_results):
    cmap = {}
    for c_entry in post_results['clusterData']:
        cId = c_entry['clusterId']
        for pid in c_entry['ids']:
            cmap[int(pid)] = cId
    df = df.copy()
    df['post_cluster'] = df.id.apply(lambda i: cmap.get(int(i),-1))
    return df

def get_rule_inference_data(df,
                           organs,
                           symptoms,
                           features, 
                           dates, 
                            include_limits=False,
                           cluster=None):
    if cluster is not None:
        df = df[df.post_cluster.astype(int) == int(cluster)]
    df_doses = extract_dose_vals(df,organs,features,include_limits=include_limits)
    outcome = get_outcomes(df,symptoms,dates)
    return df_doses,outcome
        
        
def process_rule(args):
    [df,col,y,currval,min_split_size,min_odds,min_info] = args
    vals = df[col]
    rule = vals >= currval
    entry = {
        'features': [col],
        'thresholds': [currval],
        'splits': [rule],
        'rule': rule
    }
    entry = evaluate_rule(entry,y)
    if valid_rule(entry,min_split_size,min_odds=min_odds,min_info=min_info):
        return entry
    return False
    
def get_rule_df(df,y,granularity=2,min_split_size=10,min_odds=0,min_info=.01):
    split_args = []
    minval = df.values.min().min()
    maxval = df.values.max().max()
    granularity_vals = [i*granularity + minval for i in np.arange(np.ceil(maxval/granularity))]
    for col in df.columns:
        if '_limit' in col:
            split_args.append((df,col,y,.5,1,0,0))
        else:
            for g in granularity_vals:
                split_args.append((df,col,y,g,min_split_size,min_odds,min_info))
    splits = joblib.Parallel(n_jobs=-2)(joblib.delayed(process_rule)(args) for args in split_args)
    return [s for s in splits if s is not False]

def combine_rule(r1,r2):
    if r1 is None:
        combined = r2
    elif r2 is None:
        combined = r1
    else:
        newthresholds = r1['thresholds'][:]
        newfeatures = r1['features'][:]
        newsplits = r1['splits'][:]
        newrule = r1['rule']
        fstring = stringify_features(newfeatures)
        for i,f in enumerate(r2['features']):
            #only one split per feature
            if stringify_features([f]) not in fstring:
                newfeatures.append(f)
                t = r2['thresholds'][i]
                s = r2['splits'][i]
                newthresholds.append(t)
                newsplits.append(s)
                newrule = newrule*s
        combined = {
            'features': list(newfeatures),
            'thresholds': list(newthresholds),
            'splits': newsplits,
            'rule': newrule
        }
    return combined

def evaluate_rule(rule, y):
    r = rule['rule']
    upper = y[r]
    lower = y[~r]
    entry = {k:v for k,v in rule.items()}
    entry['info'] = mutual_info_classif(r.values.reshape(-1,1),y.values.ravel(),
                                        random_state=1,discrete_features=True,n_neighbors=5)[0]
    if lower.mean().values[0] > 0:
        entry['odds_ratio'] = upper.mean().values[0]/lower.mean().values[0]
    else:
        entry['odds_ratio'] = upper.mean().values[0]
    for prefix, yy in zip(['lower','upper'],[lower,upper]):
        entry[prefix+'_count'] = yy.shape[0]
        entry[prefix+'_tp'] = yy.sum().values[0]
        entry[prefix+'_mean'] = yy.mean().values[0]
    return entry 



def filter_rules(rulelist, bests,tholds,criteria):
    is_best = lambda r: (r[criteria] >= bests.get(stringify_features(r['features']),0)) and (
        stringify_thresholds(r['thresholds']) == tholds.get(stringify_features(r['features'])) )
    filtered = [r for r in rulelist if is_best(r)]
    return filtered
    
def stringify_features(l):
    #turns a list of features in the form 'VXX_Organ' into a hashable set
    #removes V thing becuase I think it shold be per organ
    return ''.join(sorted([ll[3:] for ll in l]))

def stringify_thresholds(t):
    return ''.join([str(int(tt)) for tt in t])

def combine_and_eval_rule(args):
    [baserule,rule,outcome_df] = args
    r = combine_rule(baserule,rule)
    r = evaluate_rule(r,outcome_df)
    return r

def get_best_rules(front, allrules,outcome_df,min_odds,criteria='info'):
    new_rules = []
    bests = {}
    best_thresholds = {}
    if len(front) < 1:
        front = [None]
    minsplit = max(5,int(outcome_df.shape[0]/10))
    for baserule in front:
        combined_rules = joblib.Parallel(n_jobs=-2)(joblib.delayed(combine_and_eval_rule)((baserule,r,outcome_df)) for r in allrules)
        for combined_rule in combined_rules:
            if valid_rule(combined_rule,minsplit,min_odds):
                if (baserule is not None) and combined_rule[criteria] <= baserule.get(criteria,0):
                    continue
                rname = stringify_features(combined_rule['features'])
                if bests.get(rname,0) < combined_rule[criteria]:
                    #look at best info/odds ratio fro each set of organs
                    bests[rname] = combined_rule[criteria]
                    #svae thresholds as a tie-breaker
                    best_thresholds[rname] = stringify_thresholds(combined_rule['thresholds'])
                new_rules.append(combined_rule)
    new_rules = filter_rules(new_rules,bests,best_thresholds,criteria)
    return new_rules
    
def format_rule_json(args):
    (rule,y,symptom_y) = args
    newrule = {k:v for k,v in rule.items() if k not in ['splits','rule']}
    r = rule['rule']
    newrule['upper_ids'] = r[r].index.tolist()
    newrule['lower_ids'] = r[~r].index.tolist()
    
    x = r.values.reshape(-1,1)
    if rule['odds_ratio'] < 1:
        x = ~x
    y = y.values
    recall = recall_score(y,x)
    precision = precision_score(y,x)
    newrule['recall'] = recall
    newrule['precision'] = precision
    newrule['f1'] = (2*recall*precision)/(recall+precision)
    newrule['roc_auc'] = roc_auc_score(y,x)
    newrule['roc_auc_symptom'] = roc_auc_score(symptom_y, x)
    newrule['f1_symptom'] = f1_score(symptom_y, x)
    return newrule 

def valid_rule(r,min_split_size=10,min_odds=0,min_info=.01):
    if r['odds_ratio'] < min_odds:
        return False
    if r.get('info',0) <= min_info:
        return False
    if min(r['upper_count'],r['lower_count']) < min_split_size:
        return False
    return True
    
def get_rule_stuff(df,post_results=None):
    if post_results is None:
        print('using test post results')
        post_results = get_sample_cluster_metrics_input()
    
    df = add_post_clusters(df,post_results)
    df = add_confounder_dose_limits(df)
    
    organs = post_results.get('organs',Const.organ_list[:])
    symptoms = post_results.get('symptoms',['drymouth'])
    # organ_features = post_results.get('clusterFeatures',['V35','V40','V45','V55'])
    organ_features = ['V5','V10','V15','V20','V25','V30','V35','V40','V45','V50','V55','V60','V65','V70','V75','V80']
    organ_features.extend(['mean_dose','max_dose'])
    s_dates = post_results.get('symptom_dates',[33])
    print('____________')
    print('rule dates',s_dates)
    print('_____________')
    threshold = post_results.get('threshold',5)
    cluster = post_results.get('cluster',None)
    maxdepth = post_results.get('max_depth',3)
    min_odds = post_results.get('min_odds',0)
    min_info = post_results.get('min_info',.08)
    criteria = post_results.get('criteria','info')
    max_rules = post_results.get('max_rules',15)
    max_frontier = post_results.get('max_frontier',20)
    granularity = post_results.get('granularity',1)
    predict_cluster = post_results.get('predictCluster',-1)
    use_limits = post_results.get('useLimits',False)
    
    if criteria not in ['odds_ratio','info']:
        criteria = 'odds_ratio'
    
    df = df.set_index('id')
    if predict_cluster is not None and predict_cluster >= 0:
        cluster = None
    dose_df, outcome_df = get_rule_inference_data(
            df,
            organs,
            symptoms,
            organ_features,
            s_dates,
            cluster=cluster,
            include_limits=use_limits,
        )
    symptom_bool = (outcome_df>=threshold)
    if predict_cluster is not None and predict_cluster >= 0:
        df['temp_outcome'] = df.post_cluster.apply(lambda x: x == predict_cluster)
        y = df[['temp_outcome']]
    else:
        y = symptom_bool
    rules = get_rule_df(dose_df,y,min_odds=min_odds,granularity=granularity)
    sort_rules = lambda rlist: sorted(rlist, key=lambda x: -x[criteria])
    rules = sort_rules(rules)
    min_info = min(rules[0].get('info',0.0)*.6,float(min_info))
    rules = [r for r in rules if r.get('info',0) >= min_info]
    if len(rules) > 800:
        rules = rules[:800]
    print('n rules',len(rules))
    frontier = [None]
    best_rules = []
    depth = 0
    while (depth < maxdepth) and (frontier is not None) and (len(frontier) > 0):
        frontier = get_best_rules(frontier,rules,y,min_odds=min_odds,criteria=criteria)
        frontier = sorted(frontier, key = lambda x: -x[criteria] if x is not None else 0)
        frontier = frontier[:max_frontier]
        depth += 1
        best_rules.extend(frontier)
        print('lb',len(best_rules))
        print()
    
    best_rules = sort_rules(best_rules)
    best_rules = best_rules[:max_rules]
    best_rules = joblib.Parallel(n_jobs=-2)(joblib.delayed(format_rule_json)((br,y,symptom_bool)) for br in best_rules)
    print([(r['features'],r.get('info')) for r in best_rules])
    pos_ids = y[y.values.astype(bool)].index.values.tolist()    
    for br in best_rules:
        br['target_ids'] = pos_ids
    return best_rules


def get_metrics_model(key,is_boolean=True,balance=True,**kwargs):
    model = None
    bkey = 'balanced' if balance else None
    key = key.lower()
    if key == 'forest':
        if is_boolean:
            model = RandomForestClassifier(n_estimators=100,max_depth=4,class_weight=bkey,**kwargs)
        else:
            model = RandomForestRegressor(n_estimators=100,max_depth=4,**kwargs)
    elif key == 'adaboost_forest':
        if is_boolean:
            model = AdaBoostClassifier(base_estimator=DecisionTreeClassifier(class_weight=bkey,**kwargs))
        else:
            model = AdaBoostRegressor(base_estimator=DecisionTreeRegressor(**kwargs))
    elif key == 'adaboost_regression':
        if is_boolean:
            model = AdaBoostClassifier(base_estimator=LogisticRegression(class_weight=bkey,**kwargs))
        else:
            model = AdaBoostRegressor(base_estimator=LinearRegression(**kwargs))  
    elif key == 'linear_svm':
        if is_boolean:
            model = SVC(kernel='linear',probability=True,class_weight=bkey,**kwargs)
        else:
            model = SVR(kernel='linear',**kwargs)
    elif key == 'rbf_svm':
        if is_boolean:
            model = SVC(kernel='rbf',probability=True,class_weight=bkey,**kwargs)
        else:
            model = SVR(kernel='rbf',**kwargs)
    else:
        if is_boolean:
            model = LogisticRegression(class_weight=bkey,**kwargs)
        else:
            model = LinearRegression(**kwargs)
    return model


def get_stratification_metrics(y,ypred):
    #binary
    squeeze = lambda x: np.argmax(x,axis=1).ravel()
#     y_true = pd.get_dummies(y.loc[:,model.classes_]).values#one-hot encoe
    y_true = y.reshape(-1,1)#binary output shoud work like this idk
    roc = roc_auc_score(y_true,ypred[:,1])
    [precision,recall,fscore,support] = precision_recall_fscore_support(y_true,squeeze(ypred),average='binary')
    fbeta = lambda b: (1+b**2)*(precision*recall + .001)/((b**2)*precision + recall + .001)
    f_half = fbeta(.5)
    f2 = fbeta(2)
    matthews = matthews_corrcoef(y_true,squeeze(ypred))
    dor = ((recall*precision) + .001)/((1-recall)*(1-precision) + .001)
    results=  {
        'roc': roc, 
        'mcc': matthews,
        'dor': dor,
        'precision': precision,
        'recall':recall,
        'f1': fscore,
        'f_half': f_half,
        'f2': f2,
    }
    return results

def predict_cv(model,x,y,cvsize=None):
    #currently leave-one-out
    predictions = []
    y = y.reshape(-1,1)
    if cvsize == None:
        cvsize = int(x.shape[0]*.1)+1
    nsteps = int(np.ceil(x.shape[0]/cvsize))
    start = 0
    for i in range(nsteps):
        stop = min(start + cvsize,x.shape[0])
        test_idx = np.arange(start,stop)
        x_train = np.delete(x, test_idx,axis=0)
        x_test = x[test_idx]
        y_train = np.delete(y,test_idx)
        y_test = y[test_idx]
        
        if x_test.ndim < 2:
            x_test = x_test.reshape(1,-1)
        model.fit(x_train,y_train)
        
        ypred = model.predict_proba(x_test)
        predictions.append(ypred)
        
        start=stop
    ypred = np.concatenate(predictions)
    ypred = ypred.reshape(x.shape[0],-1)
    return ypred

def get_cluster_metrics(df,post_results=None):
    if post_results is None:
        print('using test post results')
        post_results = get_sample_cluster_metrics_input()
    
    df = add_post_clusters(df,post_results)
    df = add_confounder_dose_limits(df)
    
    symptom = post_results.get('symptom','drymouth')
    s_dates = post_results.get('symptom_dates',[13,33])
    thresholds = post_results.get('thresholds',[3,5,7])
    
    confounders = post_results.get('confounders',['t3','t4','n3','n2','hpv'])
    model_type = post_results.get('modelType','regression')
    balance_model = post_results.get('balance',True)
    m = lambda : get_metrics_model(model_type,balance=balance_model,is_boolean=True)
    # model = m()get_metrics_model(model_type,balance=balance_model,is_boolean=True)
    x_clust = Utils.onehotify(df[['post_cluster']])
    
    outcome = get_outcomes(df,[symptom],s_dates)
    
    x_conf = Utils.onehotify(df[confounders].fillna(0),drop_first=True)
#     x_conf = (x_conf - x_conf.min())/(x_conf.max() - x_conf.min())
    x_conf = (x_conf - x_conf.mean())/x_conf.std()
    
    argList = [(x_clust, x_conf, outcome,m(),t,symptom) for t in thresholds]
    stacked_results = joblib.Parallel( n_jobs=-2 )(joblib.delayed(get_cluster_cv_metrics)(args) for args in argList)
    results = []
    for sr in stacked_results:
        results.extend(sr)
    return results

def get_cluster_cv_metrics(args):
    [x_clust,x_conf,outcome,model,threshold,symptom] = args
    y = (outcome > threshold).values
    ypred_base = predict_cv(model,x_conf.values,y)
    x_full = pd.concat([x_clust.iloc[:,1:],x_conf],axis=1)
    ypred_full = predict_cv(model,x_full.values,y)
    res_base = get_stratification_metrics(y,ypred_base)
    results = []
    def get_diff(r):
        diff = {}
        for k,v in r.items():
            if res_base.get(k) is not None:
                diff[k] = v - res_base.get(k)
        return diff
    res_full = get_stratification_metrics(y,ypred_full)
    res_dict = {'all': res_full}
    for col in x_clust.columns:
        if '_-1' in col:
            continue
        x_temp = pd.concat([x_conf,x_clust[[col]]],axis=1)
        ypred_temp = predict_cv(model,x_temp.values,y)
        temp_res = get_stratification_metrics(y,ypred_temp)
        res_dict[col] = temp_res
    for name, item in res_dict.items():
        entry = {k:v for k,v in item.items()}
        temp_diff = get_diff(item)
        for k,v in temp_diff.items():
            entry[k+'_change']= v
        entry['cluster'] = name
        entry['threshold'] = threshold
        entry['symptom'] = symptom
        results.append(entry)
    return results


def get_lrt_json(df, post_results=None):
    if post_results is None:
        print('using test post results')
        post_results = get_sample_cluster_metrics_input()
    
    df = add_post_clusters(df,post_results)
    
    symptoms = post_results.get('symptoms',['drymouth'])
    dates = post_results.get('endpoints',[[13],[33]])
    thresholds = post_results.get('thresholds',[-5,5])
    confounders = post_results.get('confounders',['hpv','age_65'])
    old_cols = set(df.columns)
    df = get_cluster_lrt(df,
                         clust_key='post_cluster',
                         symptoms=symptoms,
                         nWeekList=dates,
                         thresholds=thresholds,
                         confounders=confounders,
                                 )
    to_keep = ['post_cluster'] + [c for c in df.columns if c not in old_cols and c not in ['x','y']]
    df = df[to_keep].groupby('post_cluster').first()
    df.index.name = 'clusterId'
    return df.reset_index().to_dict(orient='records')