import numpy as np
import pandas as pd
import torch
import re
from sklearn.metrics import balanced_accuracy_score, roc_auc_score,accuracy_score,precision_recall_fscore_support
from Constants import *
from Preprocessing import *
from Models import *
import copy
from Utils import *
import re
from scipy.spatial.distance import cdist

def process_mdasi_input(mdasi,imputed_version=True):
    to_keep = ['id','age','gender','packs_per_year','hpv','total_dose','dose_fraction',
               'White/Caucasion','Hispanic/Latino','African American/Black','Asian',
               'bilateral',
              ]
#     if not imputed_version:
    mdasi=mdasi.copy()
#     mdasi['id'] = mdasi['ID'].apply(lambda x: int(x.replace('STIEFEL_','')))
    mdasi['gender'] = mdasi['gender'].apply(lambda x: x == 'M')
    mdasi['total_dose']=mdasi['rt_dose'].fillna(0)
    mdasi['dose_fraction'] = mdasi['rt_fraction'].fillna(0)
    mdasi['White/Caucasion'] = mdasi['race'].apply(lambda x: x == '2106-3')
    mdasi['Hispanic/Latino'] = mdasi['ethnicity'].apply(lambda x: x == '2135-2')
    mdasi['African American/Black'] = mdasi['race'].apply(lambda x: x == '2054-5')
    mdasi['Asian'] = mdasi['race'].apply(lambda x: x == '2028-9')
    mdasi['hpv'] = mdasi['p16_hpv_postive'].apply(lambda x: int(x) if int(x) != 99 else -1)
    mdasi['bilateral'] = mdasi['tumor_laterality'].fillna(0).apply(lambda x: int(x) == 3)
    mdasi['packs_per_year'] = mdasi['pack_years'].copy().fillna(0)
    subsites = [
        'BOT','GPS','Tonsil','Soft palate','NOS'
    #     'Pharyngeal wall'
    ]
    for subsite in subsites:
        mdasi['subsite_'+subsite] = mdasi['site_of_tumor'].apply(lambda x: x == subsite.replace(' ','_'))
        to_keep.append('subsite_'+subsite)

    tstages = [1,2,3,4]
    nstage_map = {
        'nx': 0,
        'n0': 0,
        'n1': 1,
        'n2': 2,
        'n2a': 1,
        'n2b': 2,
        'n2c': 3,
        'n3': 3
    }
    for ts in tstages:
        mdasi['T-category_'+ str(ts)] = mdasi['t_nominal'].apply(lambda x: int(x[1]) == ts if x.lower() != 'tx' else False)
        to_keep.append('T-category_'+str(ts))

        ns = ts-1
        mdasi['N-category_'+ str(ns)] = mdasi['n_nominal'].apply(lambda x: nstage_map.get(x.lower()) == ns)
        to_keep.append('N-category_'+str(ns))

    for c1, c2 in zip(Const.decisions,['ic','concurrent','nd']):
        mdasi[c1] = mdasi[c2].fillna(0)
        to_keep.append(c1)
    return mdasi[to_keep].set_index('id')

def get_symptoms(m):
    candidates = list(m.columns)
    options = [re.match('mdasi_([a-zA-Z]+)_',test) for test in candidates]
    options = [o for o in options if o is not None]
    return sorted(list(set([o.group(1) for o in options if '_' not in o.group(1)])))


def getint(string):
    result = re.findall(r'\d+',string)
    if result is None:
        return None
    return int(result[0])

def get_symptom_df(mdasi,max_weeks = 30):
    #approx weeks relative to rt end
    mwratio = 30.5/7
    time_map = {
        '12_months_arm_6': 12*mwratio,
        '18to24_months_arm_6': (18+24)*mwratio/2,
        '3to6_months_arm_6': (3+6)*mwratio/2,
        '60_months_arm_6': 60*mwratio,
        '6_wks_after_primar_arm_6': 6,
        'baseline_arm_1': -7,
        'end_of_xrt_arm_3': 0,
    }
    symptoms = get_symptoms(mdasi)
    cols = list(mdasi.columns)
    sdf = {}
    weekset = set([])
    for symp in symptoms:
        scols = [c for c in cols if symp+'_' in c and '_score_' not in c]
        ratings = []
        for sc in scols:
            key = sc.replace('mdasi_','').replace(symp+'_','')
            weeks = time_map.get(key)
            if weeks > max_weeks:
                continue
            if weeks is None:
                print('issue',symp,sc,key)
                continue
            wk = int(np.round(weeks+7,0))
            weekset.add(wk)
            values = mdasi[sc].fillna(-1).values
            sdf[symp+'_'+str(wk)] = values
    sdf = pd.DataFrame(sdf,index=mdasi.id.values)
    sdf_cols = list(sdf.columns)
    sdf_cols = sorted(sdf_cols, key = getint)
    sdf_cols = sorted(sdf_cols,key=lambda x: re.match('[a-z]+',x).group(0))
    sdf = sdf[sdf_cols]
    return sdf,list(sorted(weekset)), symptoms

def sdf_symptom_array(s,symptoms):
    all_cols = []
    for symptom in symptoms:
        cols = [c for c in s.columns if symptom+'_' in c]
        cols = sorted(cols, key = getint)
        all_cols.extend(cols)
    df = s[all_cols].copy()
    return df.values

def load_mdasi_stuff():
    model = torch.load('../resources/symptomImputer.pt')
    mdasi_base = pd.read_excel('../data/mdasi_updated.xlsx').drop('Unnamed: 0',axis=1)
    mdasi_imputed = pd.read_csv('../data/mdasi_imputed.csv').drop('Unnamed: 0',axis=1)
    mdasi_base['id'] = mdasi_base['ID'].apply(lambda x: int(x.replace('STIEFEL_','')))
    mdasi_imputed['id'] = mdasi_imputed['ID'].apply(lambda x: int(x.replace('STIEFEL_','')))
    return model, mdasi_base, mdasi_imputed

# +
def get_knn(model,xin,mdf,sdf,symptom_subset=None,k=10,dates=[0,7,12,27]):
    xalt = df_to_torch(mdf)
    embeddings = model.get_embedding(xin).cpu().detach().numpy()
    base_embeddings = model.get_embedding(xalt).cpu().detach().numpy()
    dists = cdist(embeddings,base_embeddings)[0]
    order = np.argsort(dists)[:k]
    dists = dists[order]
    
    mdasi_ids= mdf.index
    ids = mdasi_ids[order]
    symptoms = sdf.loc[ids]
    
    if symptom_subset is None:
        symptom_subset = Const.prediction_symptoms
    res = {'ids': ids.tolist(),'dists': dists.tolist()}
    sentries = {}
    for sym in symptom_subset:
        if sym == 'core':
            continue
        cols = [c for c in symptoms.columns if sym+'_' in c]
        values = symptoms[cols].values
        entry = {'ratings': values.tolist()}
        means = []
        for cidx in range(values.shape[1]):
            subvals = values[:,cidx]
            subvals = [v for v in subvals if v >= 0]
            means.append(np.mean(subvals))
        entry['means'] = means
        sentries[sym] = entry
    return {'ids': ids.tolist(),'dists':dists.tolist(),'symptoms':sentries}

def get_knn_predictions(fdict,
                        model,
                        mdasi,
                        k=10,
                        ttype=torch.FloatTensor,
                        dates=[0,7,12,27],
                        symptom_subset = None,
                        decision_state=0,#0 is default, 1,2,3 are ic,cc,nd?
                       ):
    

    mdasi_df = process_mdasi_input(mdasi)
    sdf,output_dates,output_symptoms = get_symptom_df(mdasi)
    
    
    order = mdasi_df.columns
    xin = torch.tensor([fdict[k] for k in order]).type(ttype).view(1,-1) 

    if decision_state == 0:
        se = get_knn(model,xin,mdasi_df,sdf,k=k,symptom_subset=symptom_subset,dates=dates)
        se['dates'] = dates
        res = se
    
    else:
        dcol = Const.decisions[decision_state-1]
        print(dcol)
        mdasi_df_treated = mdasi_df[mdasi_df[dcol].astype(float) > .5]
        mdasi_df_untreated = mdasi_df[mdasi_df[dcol].astype(float) < .5]
        se_treated = get_knn(model,xin,mdasi_df_treated,sdf,k=k,symptom_subset=symptom_subset,dates=dates)
        se_untreated = get_knn(model,xin,mdasi_df_untreated,sdf,k=k,symptom_subset=symptom_subset,dates=dates)
        res = {'treated': se_treated,'untreated': se_untreated,'dates': dates}
    return res


# -

def get_symptom_predictions(fdict,
                        model,
                        order=None,
                        k=10,
                        ttype=torch.FloatTensor,
                        dates=[0,7,12,27],
                        symptom_subset = None,
                        decision_state=0,#0 is default, 1,2,3 are ic,cc,nd?
                       ):

    
    if order is None:
        order = Const.mdasi_input_cols

    xin = torch.tensor([fdict[k] for k in order]).type(ttype).view(1,-1) 

    model.eval()
    model.disable_dropout()
    ypred = model(xin).cpu().detach().numpy()

    symptoms = Const.prediction_symptoms
    if symptom_subset is None:
        symptom_subset = Const.prediction_symptoms
    curpos = 0
    results = {s: {'means':[],'ratings': []} for s in symptom_subset}
    
    for sym in symptoms:
        if sym not in symptom_subset:
            curpos += len(dates)
            continue
        values = ypred[:,curpos:curpos+len(dates)].tolist()[0]
        curpos += len(dates)
        results[sym]['means'] = values
        
    for i in range(k):
        model.enable_dropout()
        ypred = model(xin).cpu().detach().numpy()
        curpos = 0
        for sym in symptoms:
            if sym not in symptom_subset:
                curpos += len(dates)
                continue
            values = ypred[:,curpos:curpos+len(dates)].tolist()[0]
            curpos += len(dates)
            cur_res = results[sym]['ratings']
            cur_res.append(values)
            results[sym]['ratings'] = cur_res
    model.disable_dropout()
    return {'dates': dates,'symptoms': results}
