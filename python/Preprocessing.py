import pandas as pd
import numpy as np
from Constants import Const
import re
from imblearn.over_sampling import SMOTE

def preprocess(data_cleaned):
    #this was Elisa's preprocessing except I removed all the Ifs because that's dumb
    if len(data_cleaned.shape) < 2:
        data_cleaned = pd.DataFrame([data], columns=data.index)
        
    data_cleaned.loc[data_cleaned['Aspiration rate Pre-therapy'] == 'N', 'Aspiration rate Pre-therapy'] = 0
    data_cleaned.loc[data_cleaned['Aspiration rate Pre-therapy'] == 'Y', 'Aspiration rate Pre-therapy'] = 1

    data_cleaned.loc[data_cleaned['Pathological Grade'] == 'I', 'Pathological Grade'] = 1
    data_cleaned.loc[data_cleaned['Pathological Grade'] == 'II', 'Pathological Grade'] = 2
    data_cleaned.loc[data_cleaned['Pathological Grade'] == 'III', 'Pathological Grade'] = 3
    data_cleaned.loc[data_cleaned['Pathological Grade'] == 'IV', 'Pathological Grade'] = 4

    data_cleaned.loc[(data_cleaned['T-category'] == 'Tx') | (data_cleaned['T-category'] == 'Tis'), 'T-category'] = 1
    data_cleaned.loc[data_cleaned['T-category'] == 'T1', 'T-category'] = 1
    data_cleaned.loc[data_cleaned['T-category'] == 'T2', 'T-category'] = 2
    data_cleaned.loc[data_cleaned['T-category'] == 'T3', 'T-category'] = 3
    data_cleaned.loc[data_cleaned['T-category'] == 'T4', 'T-category'] = 4

    data_cleaned.loc[data_cleaned['N-category'] == 'N0', 'N-category'] = 0
    data_cleaned.loc[data_cleaned['N-category'] == 'N1', 'N-category'] = 1
    data_cleaned.loc[data_cleaned['N-category'] == 'N2', 'N-category'] = 2
    data_cleaned.loc[data_cleaned['N-category'] == 'N3', 'N-category'] = 3

    data_cleaned.loc[data_cleaned['N-category_8th_edition'] == 'N0', 'N-category_8th_edition'] = 0
    data_cleaned.loc[data_cleaned['N-category_8th_edition'] == 'N1', 'N-category_8th_edition'] = 1
    data_cleaned.loc[data_cleaned['N-category_8th_edition'] == 'N2', 'N-category_8th_edition'] = 2
    data_cleaned.loc[data_cleaned['N-category_8th_edition'] == 'N3', 'N-category_8th_edition'] = 3

    data_cleaned.loc[data_cleaned['AJCC 7th edition'] == 'I', 'AJCC 7th edition'] = 1
    data_cleaned.loc[data_cleaned['AJCC 7th edition'] == 'II', 'AJCC 7th edition'] = 2
    data_cleaned.loc[data_cleaned['AJCC 7th edition'] == 'III', 'AJCC 7th edition'] = 3
    data_cleaned.loc[data_cleaned['AJCC 7th edition'] == 'IV', 'AJCC 7th edition'] = 4

    data_cleaned.loc[data_cleaned['AJCC 8th edition'] == 'I', 'AJCC 8th edition'] = 1
    data_cleaned.loc[data_cleaned['AJCC 8th edition'] == 'II', 'AJCC 8th edition'] = 2
    data_cleaned.loc[data_cleaned['AJCC 8th edition'] == 'III', 'AJCC 8th edition'] = 3
    data_cleaned.loc[data_cleaned['AJCC 8th edition'] == 'IV', 'AJCC 8th edition'] = 4

    data_cleaned.loc[data_cleaned['Gender'] == 'Male', 'Gender'] = 1
    data_cleaned.loc[data_cleaned['Gender'] == 'Female', 'Gender'] = 0


    data_cleaned.loc[data_cleaned['HPV/P16 status'] == 'Positive', 'HPV/P16 status'] = 1
    data_cleaned.loc[data_cleaned['HPV/P16 status'] == 'Negative', 'HPV/P16 status'] = -1
    data_cleaned.loc[data_cleaned['HPV/P16 status'] == 'Unknown', 'HPV/P16 status'] = 0

    data_cleaned.loc[data_cleaned[
                         'Smoking status at Diagnosis (Never/Former/Current)'] == 'Formar', 'Smoking status at Diagnosis (Never/Former/Current)'] = .5
    data_cleaned.loc[data_cleaned[
                         'Smoking status at Diagnosis (Never/Former/Current)'] == 'Current', 'Smoking status at Diagnosis (Never/Former/Current)'] = 1
    data_cleaned.loc[data_cleaned[
                         'Smoking status at Diagnosis (Never/Former/Current)'] == 'Never', 'Smoking status at Diagnosis (Never/Former/Current)'] = 0


    data_cleaned.loc[data_cleaned['Chemo Modification (Y/N)'] == 'Y', 'Chemo Modification (Y/N)'] = 1

    data_cleaned.loc[data_cleaned['DLT (Y/N)'] == 'N', 'DLT (Y/N)'] = 0
    data_cleaned.loc[data_cleaned['DLT (Y/N)'] == 'Y', 'DLT (Y/N)'] = 1

    data_cleaned['DLT_Other'] = 0
    for index, row in data_cleaned.iterrows():
        if row['DLT_Type'] == 'None':
            continue
        for i in re.split('&|and|,', row['DLT_Type']):
            if i.strip() != '' and data_cleaned.loc[index, Const.dlt_dict[i.strip()]] == 0:
                data_cleaned.loc[index, Const.dlt_dict[i.strip()]] = 1

    data_cleaned.loc[data_cleaned['Decision 2 (CC / RT alone)'] == 'RT alone', 'Decision 2 (CC / RT alone)'] = 0
    data_cleaned.loc[data_cleaned['Decision 2 (CC / RT alone)'] == 'CC', 'Decision 2 (CC / RT alone)'] = 1

    data_cleaned.loc[data_cleaned['CC modification (Y/N)'] == 'N', 'CC modification (Y/N)'] = 0
    data_cleaned.loc[data_cleaned['CC modification (Y/N)'] == 'Y', 'CC modification (Y/N)'] = 1

    data_cleaned['DLT_Dermatological 2'] = 0
    data_cleaned['DLT_Neurological 2'] = 0
    data_cleaned['DLT_Gastrointestinal 2'] = 0
    data_cleaned['DLT_Hematological 2'] = 0
    data_cleaned['DLT_Nephrological 2'] = 0
    data_cleaned['DLT_Vascular 2'] = 0
    data_cleaned['DLT_Infection (Pneumonia) 2'] = 0
    data_cleaned['DLT_Other 2'] = 0
    for index, row in data_cleaned.iterrows():
        if row['DLT 2'] == 'None':
            continue
        for i in re.split('&|and|,', row['DLT 2']):
            if i.strip() != '':
                data_cleaned.loc[index, Const.dlt_dict[i.strip()] + ' 2'] = 1

    data_cleaned.loc[
        data_cleaned['Decision 3 Neck Dissection (Y/N)'] == 'N', 'Decision 3 Neck Dissection (Y/N)'] = 0
    data_cleaned.loc[
        data_cleaned['Decision 3 Neck Dissection (Y/N)'] == 'Y', 'Decision 3 Neck Dissection (Y/N)'] = 1

    return data_cleaned

def merge_editions(row,basecol='AJCC 8th edition',fallback='AJCC 7th edition'):
    if pd.isnull(row[basecol]):
        return row[fallback]
    return row[basecol]


def preprocess_dt_data(df,extra_to_keep=None):
    
    to_keep = ['id','hpv','age','packs_per_year','smoking_status','gender','Aspiration rate Pre-therapy','total_dose','dose_fraction'] 
    to_onehot = ['T-category','N-category','AJCC','Pathological Grade','subsite','treatment','laterality','ln_cluster']
    to_onehot = [c for c in to_onehot if c in df.columns]
    if extra_to_keep is not None:
        to_keep = to_keep + [c for c in extra_to_keep if c not in to_keep and c not in to_onehot]
    
    df['bilateral'] = df['laterality'].apply(lambda x: x.lower().strip() == 'bilateral')
    to_keep.append('bilateral')
    
    decisions =Const.decisions
    outcomes = Const.outcomes
    
    modification_types = {
        0: 'no_dose_adjustment',
        1: 'dose_modified',
        2: 'dose_delayed',
        3: 'dose_cancelled',
        4: 'dose_delayed_&_modified',
        5: 'regiment_modification',
        9: 'unknown'
    }
    
    cc_types = {
        0: 'cc_none',
        1: 'cc_platinum',
        2: 'cc_cetuximab',
        3: 'cc_others',
    }

#     races_shortened = ['White/Caucasian','Hispanic/Latino','African American/Black']
#     for race in races_shortened:
#         df[race] = df['Race'].apply(lambda x: x.strip() == race)
#         to_keep.append(race)

    for k,v in Const.cc_types.items():
        df[v] = df['CC Regimen(0= none, 1= platinum based, 2= cetuximab based, 3= others, 9=unknown)'].apply(lambda x: int(Const.cc_types.get(int(x),0) == v))
        to_keep.append(v)
    for k,v in Const.modification_types.items():
        name = 'Modification Type (0= no dose adjustment, 1=dose modified, 2=dose delayed, 3=dose cancelled, 4=dose delayed & modified, 5=regimen modification, 9=unknown)'
        df[v] = df[name].apply(lambda x: int(Const.modification_types.get(int(x),0) == v))
        to_keep.append(v)
    #Features to keep. I think gender is is in 
    
    for col in Const.dlt1 + Const.dlt2:
        df[col] = (df[col] > 0).astype(float)
    keywords = []
    for keyword in keywords:
        toadd = [c for c in df.columns if keyword in c and c not in to_keep]
        to_keep = to_keep + toadd
    
    df['packs_per_year'] = df['packs_per_year'].apply(lambda x: str(x).replace('>','').replace('<','')).astype(float).fillna(0)
    #so I'm actually not sure if this is biological sex or gender given this is texas
    df['AJCC'] = df.apply(lambda row: merge_editions(row,'ajcc8','ajcc7'),axis=1)
    df['N-category'] = df.apply(lambda row: merge_editions(row,'N-category_8th_edition','N-category'),axis=1)
    
    dummy_df = pd.get_dummies(df[to_onehot].fillna(0).astype(str),drop_first=False)
    for col in dummy_df.columns:
        df[col] = dummy_df[col]
        to_keep.append(col)
        
    yn_to_binary = ['FT','Aspiration rate Post-therapy','Decision 1 (Induction Chemo) Y/N']
    for col in yn_to_binary:
        df[col] = df[col].apply(lambda x: int(x == 'Y'))
        
    to_keep = to_keep + [c for c in df.columns if 'DLT' in c]
    
    for statelist in [Const.state2,Const.state3,Const.decisions,Const.outcomes]:
        toadd = [c for c in statelist if c not in to_keep]
        to_keep = to_keep + toadd
        
   
    return df[to_keep].set_index('id')

def load_digital_twin(file='../data/digital_twin_data.csv'):
    df = pd.read_csv(file)
    return df.rename(columns = Const.rename_dict)

def smoteify(df,ycols,**kwargs):
    subdf = df.copy().fillna(0)
    y = subdf[ycols].apply(lambda x: ''.join([str(r) for r in x]), axis=1)
    smote = SMOTE(sampling_strategy='not majority',n_jobs=-2,random_state=0,**kwargs)
    smote_df = smote.fit_resample(subdf,y)
    xnew, ynew = smote_df
    return xnew

def get_side(row):
    side = 'R'
    if row['laterality_L'] > 0:
        side= 'L'
    elif row['laterality_R'] > 0:
        side = 'R'
    else:
        lsum = 0
        rsum = 0
        for name in row.index:
            if len(name) < 5:
                if name[0] == 'L':
                    lsum += row[name]
                if name[0] == 'R':
                    rsum += row[name]
        if lsum > rsum:
            side = 'L'
    return side

def get_ipsi(row,ln):
    side = get_side(row)
    return row[side+ln]

def get_contra(row,ln):
    side = get_side(row)
    side = 'L' if side == 'R' else 'R'
    return row[side+ln]

def fix_ln_laterality(df,lncols=None):
    df = df.copy()
    if lncols is None:
        lncols = [c[1:] for c in df.columns if (c[0] == 'L' and len(c) < 4) or c == 'LRPLN']
    for col in lncols:
        df[col+'_ipsi'] = df.apply(lambda x: get_ipsi(x,col),axis=1)
        df[col+'_contra'] = df.apply(lambda x: get_contra(x,col),axis=1)      
    to_drop = ['L' + c for c in lncols] + ['R' + c for c in lncols]
    return df.drop(to_drop,axis=1)

class DTDataset():
    
    def __init__(self,
                 data_file = '../data/digital_twin_data.csv',
                 ln_data_file = '../data/digital_twin_ln_monograms.csv',
                 ids=None,
                 use_smote=False,
                 smote_columns = ['Overall Survival (4 Years)','FT','Aspiration rate Post-therapy'],#only is use_smote=True
                 smote_kwargs={},
                 smote_ids = None, #if we want to only upsample select (i.e. train) ids
                ):
        df = pd.read_csv(data_file)
        df = preprocess(df)
        df = df.rename(columns = Const.rename_dict).copy()
        df = df.drop('MRN OPC',axis=1)

        ln_data = pd.read_csv(ln_data_file)
        if 'ln_cluster' in ln_data:
            ln_data = ln_data.rename(columns={'cluster':'ln_cluster'})
        self.ln_cols = [c for c in ln_data.columns if c not in df.columns]
        df = df.merge(ln_data,on='id')
        
        df.index = df.index.astype(int)
        if ids is not None:
            df = df[df.id.apply(lambda x: x in ids)]
        processed_df = preprocess_dt_data(df,self.ln_cols).fillna(0).drop(['DLT_Type','DLT 2'],axis=1)
        processed_df = fix_ln_laterality(processed_df)
        self.processed_df= processed_df.drop(['laterality_L','laterality_R','laterality_Bilateral'],axis=1)
        
        if use_smote:
            smote_df = self.processed_df.copy()
            unsmote_df = None
            max_index = smote_df.index.max()
            if smote_ids is not None:
                print('here')
                smote_df = smote_df.loc[smote_ids]
                unsmote_df = self.processed_df.drop(smote_df.index,axis=0).copy()
            smote_df = smoteify(smote_df,smote_columns,**smote_kwargs)
            #make it so the new stuff has different ids than the original
            if smote_ids is not None:
                newindex = []
                unsmote_index = set(unsmote_df.index.values)
                for i,val in enumerate(smote_df.index.values):
                    if val in unsmote_index:
                        val = max_index + 1
                        max_index += 1
                    newindex.append(val)
                smote_df.index = newindex
                smote_df = pd.concat([smote_df,unsmote_df],axis=0)
            self.processed_df = smote_df
          
        self.means = self.processed_df.mean(axis=0)
        self.stds = self.processed_df.std(axis=0)
        self.maxes = self.processed_df.max(axis=0)
        self.mins = self.processed_df.min(axis=0)
        
        arrays = self.get_states()
        self.state_sizes = {k: (v.shape[1] if v.ndim > 1 else 1) for k,v in arrays.items()}
        
    def get_data(self):
        return self.processed_df
    
    def sample(self,frac=.5):
        return self.processed_df.sample(frac=frac)
    
    def split_sample(self,ratio = .3):
        assert(ratio > 0 and ratio <= 1)
        df1 = self.processed_df.sample(frac=1-ratio)
        df2 = self.processed_df.drop(index=df1.index)
        return df1,df2
    
    def get_states(self,fixed=None,ids = None):
        processed_df = self.processed_df.copy()
        if ids is not None:
            processed_df = processed_df.loc[ids]
        if fixed is not None:
            for col,val in fixed.items():
                if col in processed_df.columns:
                    processed_df[col] = val
                else:
                    print('bad fixed entry',col)
                    
        to_skip = ['CC Regimen(0= none, 1= platinum based, 2= cetuximab based, 3= others, 9=unknown)'] + [c for c in processed_df.columns if 'treatment' in c]
        to_skip = [c for c in to_skip if c in processed_df.columns]
        other_states = set(Const.decisions + Const.state3 + Const.state2 + Const.outcomes  + to_skip)

        base_state = sorted([c for c in processed_df.columns if c not in other_states])

        dlt1 = Const.dlt1
        dlt2 = Const.dlt2
        
        modifications = Const.modifications
        ccs = Const.ccs
        pds = Const.primary_disease_states
        nds = Const.nodal_disease_states
        pds2 = Const.primary_disease_states2
        nds2 = Const.nodal_disease_states2
        outcomes = Const.outcomes
        decisions= Const.decisions
        
        #intermediate states are only udated values. Models should use baseline + state2 etc
        results = {
            'baseline': processed_df[base_state],
            'pd_states1': processed_df[pds],
            'nd_states1': processed_df[nds],
            'modifications': processed_df[modifications],
            'ccs': processed_df[ccs],
            'pd_states2': processed_df[pds2],
            'nd_states2': processed_df[nds2],
            'outcomes': processed_df[outcomes],
            'dlt1': processed_df[dlt1],
            'dlt2': processed_df[dlt2],
            'decision1': processed_df[decisions[0]],
            'decision2': processed_df[decisions[1]],
            'decision3': processed_df[decisions[2]],
            'survival': processed_df[outcomes[0]],
            'ft': processed_df[outcomes[1]],
            'aspiration': processed_df[outcomes[2]],
        }
    
        return results
    
    def get_state(self,name,**kwargs):
        return self.get_states(**kwargs)[name]
    
    def normalize(self,df):
        means = self.means[df.columns]
        std = self.stds[df.columns]
        return ((df - means)/std).fillna(0)
    
    def get_intermediate_outcomes(self,step=1,**kwargs):
        assert(step in [0,1,2,3])
        states = self.get_states(**kwargs)
        if step == 1:
            keys = ['pd_states1','nd_states1','modifications','dlt1']
        if step == 2:
            keys =  ['pd_states2','nd_states2','ccs','dlt2']
        if step == 3:
            keys = ['survival','ft','aspiration']# ['decision1','decision2','decision3']
        if step == 0:
            keys = ['decision1','decision2','decision3']
        if len(keys) < 2:
            return states[keys[0]]
        return [states[key] for key in keys]
    
    def get_input_state(self,step=1,**kwargs):
        assert(step in [0,1,2,3])
        states = self.get_states(**kwargs)
        if step == 0:
            keys = ['baseline']
        if step == 1:
            keys = ['baseline','decision1']
        if step == 2:
            keys =  ['baseline','pd_states1','nd_states1','modifications','dlt1','decision1','decision2']
        if step == 3:
            keys = ['baseline','pd_states2','nd_states2','ccs','dlt2','decision1','decision2','decision3']
        arrays = [states[key] for key in keys]
        if len(arrays) < 2:
            return arrays[0]
        return pd.concat(arrays,axis=1)
